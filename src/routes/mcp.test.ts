import { describe, it, expect, beforeAll } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { sign } from "jsonwebtoken";
import { SARA_ISSUER_IDENTITY, useCache } from "../utils/sara-token";
import { getUserProfile } from "../databases/models/user-profile";

describe("Route /mcp/tokens & MCP Token Management", () => {
    let server: any;
    let fakeToken: string;
    let privateKeyPem: string;

    beforeAll(async () => {
        const { privateKey, publicKey } = generateKeyPairSync("ec", {
            namedCurve: "prime256v1",
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });

        privateKeyPem = privateKey;
        process.env.SARA_PUBLIC_KEY = publicKey;
        process.env.SARA_AUDIENCE_URL = "https://web-tech.tw";
        useCache().set("sara_token:tok_test_123", true, 3600);
        useCache().set("sara_token:tok_test_456", true, 3600);

        fakeToken = sign(
            {
                sub: "usr_123456",
                jti: "tok_test_123",
                user: {
                    _id: "usr_123456",
                    nickname: "Nymph",
                    email: "nymph@example.com",
                    avatar_hash: "d41d8cd98f00b204e9800998ecf8427e",
                    roles: ["Admin", "Developer"],
                },
            },
            privateKey,
            {
                algorithm: "ES256",
                issuer: SARA_ISSUER_IDENTITY,
                audience: "https://web-tech.tw",
            },
        );

        const mod = await import("./index");
        server = mod.server;
    });

    it("should render SPA tokens page HTML", async () => {
        const res = await server.handle(
            new Request("http://localhost/mcp/tokens", {
                method: "GET",
            }),
        );

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/html");
        const html = await res.text();
        expect(html).toContain("MCP 權杖簽發");
        expect(html).toContain("Sara 身分認證");
        expect(html).toContain("使用 Sara 登入");
        expect(html).toContain("Sara 系統使用者識別碼：");
    });

    it("should return 401 on /mcp/me when unauthenticated", async () => {
        const res = await server.handle(
            new Request("http://localhost/mcp/me", {
                method: "GET",
            }),
        );
        expect(res.status).toBe(401);
    });

    it("should return profile on /mcp/me when authenticated via SARA header and sync profile", async () => {
        const res = await server.handle(
            new Request("http://localhost/mcp/me", {
                method: "GET",
                headers: {
                    Authorization: ["SARA", fakeToken].join(" "),
                },
            }),
        );
        expect(res.status).toBe(200);
        const data = (await res.json()) as { id: string; profile: { nickname: string } };
        expect(data.id).toBe("usr_123456");
        expect(data.profile.nickname).toBe("Nymph");
    });

    it("should manage MCP tokens lifecycle (POST, GET, PATCH, PUT, DELETE)", async () => {
        const authHeader = ["SARA", fakeToken].join(" ");

        // 1. POST /mcp/tokens - Issue new token
        const createRes = await server.handle(
            new Request("http://localhost/mcp/tokens", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
                body: JSON.stringify({ label: "My Cursor Agent" }),
            }),
        );

        expect(createRes.status).toBe(200);
        const createData = (await createRes.json()) as {
            success: boolean;
            token: { id: string; token: string; label: string };
        };
        expect(createData.success).toBe(true);
        expect(createData.token.label).toBe("My Cursor Agent");
        expect(createData.token.token).toStartWith("nfm-");
        const tokenId = createData.token.id;
        const initialSecret = createData.token.token;

        // 2. GET /mcp/tokens?format=json - List tokens
        const listRes = await server.handle(
            new Request("http://localhost/mcp/tokens?format=json", {
                method: "GET",
                headers: {
                    Authorization: authHeader,
                },
            }),
        );
        expect(listRes.status).toBe(200);
        const listData = (await listRes.json()) as { tokens: Array<{ id: string; label: string }> };
        expect(listData.tokens.length).toBeGreaterThan(0);
        expect(listData.tokens.some((t) => t.id === tokenId)).toBe(true);

        // 3. User logs in with updated nickname in Sara Token -> auto syncs to tokens
        const updatedSaraToken = sign(
            {
                sub: "usr_123456",
                jti: "tok_test_456",
                user: {
                    _id: "usr_123456",
                    nickname: "Nymph Updated",
                    email: "nymph@example.com",
                    avatar_hash: "d41d8cd98f00b204e9800998ecf8427e",
                },
            },
            privateKeyPem,
            {
                algorithm: "ES256",
                issuer: SARA_ISSUER_IDENTITY,
                audience: "https://web-tech.tw",
            },
        );

        const meRes = await server.handle(
            new Request("http://localhost/mcp/me", {
                method: "GET",
                headers: {
                    Authorization: ["SARA", updatedSaraToken].join(" "),
                },
            }),
        );
        expect(meRes.status).toBe(200);
        const cachedProfile = await getUserProfile("usr_123456");
        expect(cachedProfile?.nickname).toBe("Nymph Updated");

        // 4. PATCH /mcp/tokens - Rename token label
        const patchRes = await server.handle(
            new Request("http://localhost/mcp/tokens", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
                body: JSON.stringify({ id: tokenId, label: "Renamed Cursor Agent" }),
            }),
        );
        expect(patchRes.status).toBe(200);
        const patchData = (await patchRes.json()) as { success: boolean; token: { label: string } };
        expect(patchData.success).toBe(true);
        expect(patchData.token.label).toBe("Renamed Cursor Agent");

        // 5. PUT /mcp/tokens - Rotate token secret
        const putRes = await server.handle(
            new Request("http://localhost/mcp/tokens", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
                body: JSON.stringify({ id: tokenId }),
            }),
        );
        expect(putRes.status).toBe(200);
        const putData = (await putRes.json()) as { success: boolean; token: { token: string } };
        expect(putData.success).toBe(true);
        expect(putData.token.token).toStartWith("nfm-");
        expect(putData.token.token).not.toBe(initialSecret);

        // 6. DELETE /mcp/token - Delete token
        const deleteRes = await server.handle(
            new Request("http://localhost/mcp/token", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
                body: JSON.stringify({ id: tokenId }),
            }),
        );
        expect(deleteRes.status).toBe(200);
        const deleteData = (await deleteRes.json()) as { success: boolean };
        expect(deleteData.success).toBe(true);

        // Verify it was deleted
        const verifyDeleteRes = await server.handle(
            new Request(`http://localhost/mcp/token?id=${tokenId}`, {
                method: "DELETE",
                headers: {
                    Authorization: authHeader,
                },
            }),
        );
        expect(verifyDeleteRes.status).toBe(404);
    });
});
