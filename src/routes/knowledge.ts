import { Elysia } from "elysia";
import { createHash, timingSafeEqual } from "node:crypto";
import { KnowledgeModel } from "../databases/models/knowledge";
import { parseFrontMatter } from "../utils/front-matter";

const MAX_CONTENT_BYTES = 15 * 1024 * 1024;
const DOC_TYPES = ["chat-archive", "engineering-paper", "digest"] as const;

export interface KnowledgeIngestPayload {
    docType: string;
    fileName: string;
    mimeType?: string;
    sha256: string;
    sizeBytes?: number;
    sourceChannelId?: string;
    uploadedBy?: string;
    transactionId?: string;
    contentBase64: string;
    meta?: {
        category?: string;
        topic?: string;
        tags?: string[];
        participants?: string[];
        knowledgeCollection?: string;
    };
}

function verifyBearerSecret(authorization: string | undefined, secret: string): boolean {
    if (!authorization) return false;
    const [rawMethod, providedToken] = authorization.split(" ");
    if (!rawMethod || !providedToken || rawMethod.toUpperCase() !== "BEARER") return false;

    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(secret);
    if (provided.length !== expected.length) return false;
    return timingSafeEqual(provided, expected);
}

function validatePayload(payload: KnowledgeIngestPayload): string | null {
    if (!payload.docType || !DOC_TYPES.includes(payload.docType as (typeof DOC_TYPES)[number])) {
        return `docType must be one of: ${DOC_TYPES.join(", ")}`;
    }
    if (!payload.fileName?.trim()) return "fileName is required";
    if (!payload.sha256?.trim()) return "sha256 is required";
    if (!payload.contentBase64) return "contentBase64 is required";
    return null;
}

/**
 * Attempt to extract plain text from PDF bytes via unpdf.
 * Returns null on any failure so ingest can fall back to a metadata stub.
 */
async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
    try {
        const { getDocumentProxy, extractText } = await import("unpdf");
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        return typeof text === "string" ? text : null;
    } catch (error) {
        console.error("[Knowledge] PDF text extraction failed:", error);
        return null;
    }
}

export async function ingestKnowledgeDocument(
    payload: KnowledgeIngestPayload,
): Promise<{ knowledgeId: string; deduped: boolean }> {
    const bytes = Buffer.from(payload.contentBase64, "base64");
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    if (payload.sha256 && payload.sha256 !== sourceHash) {
        throw new Error("sha256 mismatch: payload digest does not match content");
    }

    const lowerName = payload.fileName.toLowerCase();
    const isMarkdown = payload.mimeType === "text/markdown" || lowerName.endsWith(".md");

    let text = "";
    let frontMatter: Record<string, string | string[]> = {};
    let extractionStatus = "none";

    if (isMarkdown) {
        text = bytes.toString("utf-8");
        extractionStatus = "original";
        frontMatter = parseFrontMatter(text).meta;
    } else {
        const extracted = await extractPdfText(new Uint8Array(bytes));
        if (extracted && extracted.trim()) {
            text = extracted;
            extractionStatus = "extracted";
        } else {
            // Fallback: keep the document as a metadata stub; never fail the ingest.
            text = "";
            extractionStatus = "stub";
        }
    }

    const meta = payload.meta || {};
    const frontValue = (key: string): string | string[] | undefined => frontMatter[key];
    const pickString = (key: string, fallback?: string): string => {
        const fromFront = frontValue(key);
        if (typeof fromFront === "string" && fromFront.trim()) return fromFront;
        const fromMeta = (meta as Record<string, unknown>)[key];
        if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta;
        return fallback || "";
    };
    const pickArray = (key: string): string[] => {
        const fromFront = frontValue(key);
        if (Array.isArray(fromFront) && fromFront.length) return fromFront;
        const fromMeta = (meta as Record<string, unknown>)[key];
        if (Array.isArray(fromMeta) && fromMeta.length) return fromMeta;
        return [];
    };

    const topicFallback = payload.fileName.replace(/\.[^.]+$/, "");
    const metadata = {
        category: pickString("category", payload.docType),
        topic: pickString("topic", topicFallback),
        tags: pickArray("tags"),
        participants: pickArray("participants"),
        docType: payload.docType,
        sourceHash,
        sourceChannelId: payload.sourceChannelId,
        knowledgeCollection: meta.knowledgeCollection,
        uploadedBy: payload.uploadedBy,
        transactionId: payload.transactionId,
        originalFileName: payload.fileName,
        extractionStatus,
    };

    const existing = await KnowledgeModel.findOne({ "metadata.sourceHash": sourceHash }).lean();
    if (existing) {
        return { knowledgeId: existing._id?.toString() || "", deduped: true };
    }

    const created = await KnowledgeModel.create({ text, metadata });
    return { knowledgeId: created._id?.toString() || "", deduped: false };
}

export const knowledgeRoutes = new Elysia({ prefix: "/knowledge" })
    .post("/ingest", async ({ headers, body, set }) => {
        const secret = Bun.env.KNOWLEDGE_INGEST_SECRET || "";
        if (!secret) {
            set.status = 503;
            return { error: "Knowledge ingest is not configured" };
        }
        if (!verifyBearerSecret(headers["authorization"], secret)) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const payload = (body || {}) as KnowledgeIngestPayload;
        const invalid = validatePayload(payload);
        if (invalid) {
            set.status = 400;
            return { error: invalid };
        }

        const decodedBytes = Math.floor((payload.contentBase64.length * 3) / 4);
        if (decodedBytes > MAX_CONTENT_BYTES) {
            set.status = 413;
            return { error: "Content exceeds the 15MB limit" };
        }

        try {
            const result = await ingestKnowledgeDocument(payload);
            set.status = 202;
            return result;
        } catch (error) {
            set.status = 400;
            return { error: (error as Error).message };
        }
    });
