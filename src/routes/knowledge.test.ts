import { describe, it, expect, beforeAll, mock } from "bun:test";
import { createHash } from "node:crypto";

interface StoredDocument {
    _id?: string;
    text: string;
    metadata: Record<string, unknown>;
}

const createdDocs: StoredDocument[] = [];
let existingDoc: (StoredDocument & { _id: string }) | null = null;

const fakeModel = {
    findOne: () => ({ lean: async () => existingDoc }),
    create: async (doc: StoredDocument) => {
        const stored = { ...doc, _id: "kd_test_123" };
        createdDocs.push(stored);
        return stored;
    },
};

mock.module("../databases/models/knowledge", () => ({ KnowledgeModel: fakeModel }));

function sha256(content: string): string {
    return createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex");
}

function buildPayload(overrides: Record<string, unknown> = {}) {
    const content = "# Chat record\nHello world";
    return {
        docType: "chat-archive",
        fileName: "nymph-2026-09-29-chat-record.md",
        mimeType: "text/markdown",
        sha256: sha256(content),
        sizeBytes: Buffer.byteLength(content),
        sourceChannelId: "975639402900496414",
        uploadedBy: "usr_test",
        transactionId: "txn_test",
        contentBase64: Buffer.from(content, "utf-8").toString("base64"),
        meta: { knowledgeCollection: "knowledge-vuejs-plus" },
        ...overrides,
    };
}

function ingestRequest(body: unknown, secret = "test-secret"): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    return new Request("http://localhost/knowledge/ingest", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

describe("Route /knowledge/ingest", () => {
    let server: any;

    beforeAll(async () => {
        Bun.env.KNOWLEDGE_INGEST_SECRET = "test-secret";
        const mod = await import("./index");
        server = mod.server;
    });

    it("should return 401 without or with a wrong bearer secret", async () => {
        const noAuth = await server.handle(ingestRequest(buildPayload(), ""));
        expect(noAuth.status).toBe(401);

        const wrongSecret = await server.handle(ingestRequest(buildPayload(), "wrong-secret"));
        expect(wrongSecret.status).toBe(401);
    });

    it("should return 400 for invalid payloads", async () => {
        const badDocType = await server.handle(
            ingestRequest(buildPayload({ docType: "random" })),
        );
        expect(badDocType.status).toBe(400);

        const missingHash = await server.handle(
            ingestRequest(buildPayload({ sha256: "" })),
        );
        expect(missingHash.status).toBe(400);

        const missingContent = await server.handle(
            ingestRequest(buildPayload({ contentBase64: "" })),
        );
        expect(missingContent.status).toBe(400);
    });

    it("should return 400 when sha256 does not match content", async () => {
        const res = await server.handle(
            ingestRequest(buildPayload({ sha256: "deadbeef" })),
        );
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain("mismatch");
    });

    it("should return 413 when content exceeds 15MB", async () => {
        const oversized = "a".repeat(15 * 1024 * 1024 + 1);
        const res = await server.handle(
            ingestRequest(buildPayload({
                contentBase64: Buffer.from(oversized, "utf-8").toString("base64"),
                sha256: sha256(oversized),
                sizeBytes: oversized.length,
            })),
        );
        expect(res.status).toBe(413);
    });

    it("should store markdown verbatim and let front-matter override meta", async () => {
        existingDoc = null;
        createdDocs.length = 0;

        const content = [
            "---",
            "category: engineering",
            "topic: 週會紀錄",
            "tags: [nymph, archiver]",
            "---",
            "# 內文",
        ].join("\n");

        const res = await server.handle(
            ingestRequest(buildPayload({
                contentBase64: Buffer.from(content, "utf-8").toString("base64"),
                sha256: sha256(content),
                sizeBytes: Buffer.byteLength(content),
            })),
        );

        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.deduped).toBe(false);
        expect(data.knowledgeId).toBe("kd_test_123");

        expect(createdDocs.length).toBe(1);
        expect(createdDocs[0]!.text).toBe(content);
        const metadata = createdDocs[0]!.metadata as Record<string, unknown>;
        expect(metadata.category).toBe("engineering");
        expect(metadata.topic).toBe("週會紀錄");
        expect(metadata.tags).toEqual(["nymph", "archiver"]);
        expect(metadata.docType).toBe("chat-archive");
        expect(metadata.sourceChannelId).toBe("975639402900496414");
        expect(metadata.knowledgeCollection).toBe("knowledge-vuejs-plus");
        expect(metadata.uploadedBy).toBe("usr_test");
        expect(metadata.transactionId).toBe("txn_test");
        expect(metadata.originalFileName).toBe("nymph-2026-09-29-chat-record.md");
        expect(metadata.extractionStatus).toBe("original");
    });

    it("should fall back to a metadata stub when PDF text extraction fails", async () => {
        existingDoc = null;
        createdDocs.length = 0;

        const bytes = "this is not a real pdf";
        const res = await server.handle(
            ingestRequest(buildPayload({
                docType: "engineering-paper",
                fileName: "paper.pdf",
                mimeType: "application/pdf",
                contentBase64: Buffer.from(bytes, "utf-8").toString("base64"),
                sha256: sha256(bytes),
                sizeBytes: bytes.length,
            })),
        );

        expect(res.status).toBe(202);
        expect(createdDocs.length).toBe(1);
        expect(createdDocs[0]!.text).toBe("");
        const metadata = createdDocs[0]!.metadata as Record<string, unknown>;
        expect(metadata.extractionStatus).toBe("stub");
        expect(metadata.docType).toBe("engineering-paper");
        expect(metadata.category).toBe("engineering-paper");
        expect(metadata.topic).toBe("paper");
    });

    it("should dedupe repeated uploads of the same source hash", async () => {
        existingDoc = {
            _id: "kd_existing_999",
            text: "old",
            metadata: { sourceHash: "whatever" },
        };
        const before = createdDocs.length;

        const res = await server.handle(ingestRequest(buildPayload()));
        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.deduped).toBe(true);
        expect(data.knowledgeId).toBe("kd_existing_999");
        expect(createdDocs.length).toBe(before);

        existingDoc = null;
    });
});
