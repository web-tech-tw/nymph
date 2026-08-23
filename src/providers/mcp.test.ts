import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { createMCPClient } from "@ai-sdk/mcp";
import { Elysia } from "elysia";
import { McpProvider } from "./mcp";
import type { ChatContext } from "../types/provider";
import { KnowledgeModel } from "../databases/models/knowledge";
import * as connection from "../databases/connection";
import { createMcpToken } from "../databases/models/mcp-token";
import { cacheUserProfile } from "../databases/models/user-profile";

describe("McpProvider", () => {
    let testServer: Elysia;
    let mcpProvider: McpProvider;
    let messageHandler: (ctx: ChatContext) => Promise<void>;
    let testToken: string;
    const testUserId = "usr_mcp_999";
    const testLabel = "Test MCP Client";

    beforeEach(async () => {
        testServer = new Elysia();
        mcpProvider = new McpProvider({ server: testServer, path: "/mcp" });
        messageHandler = mock(async (ctx: ChatContext) => {
            await ctx.reply(
                `AI reply for: ${ctx.content} (sender: ${ctx.sender.id}, nick: ${ctx.sender.nickname}, room: ${ctx.roomId})`,
            );
        });
        mcpProvider.onMessage(messageHandler);
        await mcpProvider.start();

        await cacheUserProfile(testUserId, {
            nickname: "Nymph",
            email: "nymph@example.com",
            avatar_hash: "d41d8cd98f00b204e9800998ecf8427e",
        });
        const tokenRecord = await createMcpToken(testUserId, testLabel);
        testToken = tokenRecord.token;
    });

    afterEach(async () => {
        await mcpProvider.stop();
    });

    it("should return 401 when request lacks MCP token", async () => {
        const res = await testServer.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                        protocolVersion: "2024-11-05",
                        capabilities: {},
                        clientInfo: { name: "test-client", version: "1.0.0" },
                    },
                }),
            }),
        );

        expect(res.status).toBe(401);
        const json = (await res.json()) as { error: string };
        expect(json.error).toContain("Unauthorized");
    });

    it("should handle MCP initialize handshake with valid token", async () => {
        const res = await testServer.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                    Authorization: `Bearer ${testToken}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                        protocolVersion: "2024-11-05",
                        capabilities: {},
                        clientInfo: { name: "test-client", version: "1.0.0" },
                    },
                }),
            }),
        );

        expect(res.status).toBe(200);
        const text = await res.text();
        const json = JSON.parse(text);
        expect(json.jsonrpc).toBe("2.0");
        expect(json.id).toBe(1);
        expect(json.result.serverInfo.name).toBe("nymph");
    });

    it("should list consult_nymph_wisdom, absorb_nymph_wisdom, and my_nymph_impression tools", async () => {
        const res = await testServer.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                    Authorization: `Bearer ${testToken}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 2,
                    method: "tools/list",
                    params: {},
                }),
            }),
        );

        expect(res.status).toBe(200);
        const json = JSON.parse(await res.text());
        expect(json.result.tools).toBeDefined();
        const toolNames = json.result.tools.map((t: { name: string }) => t.name);
        expect(toolNames).toContain("consult_nymph_wisdom");
        expect(toolNames).toContain("absorb_nymph_wisdom");
        expect(toolNames).toContain("my_nymph_impression");
    });

    it("should call my_nymph_impression and return profile data", async () => {
        const res = await testServer.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                    Authorization: `Bearer ${testToken}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 25,
                    method: "tools/call",
                    params: {
                        name: "my_nymph_impression",
                        arguments: {},
                    },
                }),
            }),
        );

        expect(res.status).toBe(200);
        const json = JSON.parse(await res.text());
        expect(json.result.content).toBeDefined();
        const parsed = JSON.parse(json.result.content[0].text);
        expect(parsed.userId).toBe(testUserId);
        expect(parsed.nickname).toBe("Nymph");
    });

    it("should dispatch consult_nymph_wisdom with bound userId as sender", async () => {
        const res = await testServer.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                    Authorization: `Bearer ${testToken}`,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 3,
                    method: "tools/call",
                    params: {
                        name: "consult_nymph_wisdom",
                        arguments: {
                            prompt: "How to use Elysia?",
                        },
                    },
                }),
            }),
        );

        expect(res.status).toBe(200);
        const json = JSON.parse(await res.text());
        expect(json.result.content).toBeDefined();
        expect(json.result.content[0].text).toContain(`sender: ${testUserId}`);
        expect(json.result.content[0].text).toContain("nick: Nymph");
        expect(json.result.content[0].text).toContain(`room: ${testUserId}`);
        expect(messageHandler).toHaveBeenCalled();
    });

    it("should call absorb_nymph_wisdom and handle query when DB is not ready", async () => {
        const dbSpy = spyOn(connection, "isDatabaseConnected").mockReturnValue(false);

        try {
            const res = await testServer.handle(
                new Request("http://localhost/mcp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json, text/event-stream",
                        Authorization: `Bearer ${testToken}`,
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 4,
                        method: "tools/call",
                        params: {
                            name: "absorb_nymph_wisdom",
                            arguments: {
                                query: "docker compose",
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const json = JSON.parse(await res.text());
            expect(json.result.content[0].text).toContain("Database connection is not ready");
        } finally {
            dbSpy.mockRestore();
        }
    });

    it("should call absorb_nymph_wisdom and return knowledge documents when DB is connected", async () => {
        const dbSpy = spyOn(connection, "isDatabaseConnected").mockReturnValue(true);
        const findSpy = spyOn(KnowledgeModel, "find").mockReturnValue({
            sort: () => ({
                limit: () => ({
                    lean: async () => [
                        {
                            text: "Docker compose setup instructions for Bun services.",
                            metadata: {
                                topic: "Docker Compose",
                                category: "DevOps",
                            },
                            score: 0.95,
                        },
                    ],
                }),
            }),
        } as unknown as ReturnType<typeof KnowledgeModel.find>);

        try {
            const res = await testServer.handle(
                new Request("http://localhost/mcp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json, text/event-stream",
                        Authorization: `Bearer ${testToken}`,
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 5,
                        method: "tools/call",
                        params: {
                            name: "absorb_nymph_wisdom",
                            arguments: {
                                query: "docker compose",
                                category: "DevOps",
                                limit: 3,
                            },
                        },
                    }),
                }),
            );

            expect(res.status).toBe(200);
            const json = JSON.parse(await res.text());
            expect(json.result.content[0].text).toContain("<knowledge_documents");
            expect(json.result.content[0].text).toContain("Docker compose setup instructions for Bun services.");
        } finally {
            dbSpy.mockRestore();
            findSpy.mockRestore();
        }
    });

    it("should pass smoke test using Vercel AI SDK MCP Client with authorization", async () => {
        const app = testServer.listen(0);
        const port = app.server?.port;
        expect(port).toBeDefined();

        const client = await createMCPClient({
            transport: {
                type: "http",
                url: `http://127.0.0.1:${port}/mcp`,
                headers: {
                    Authorization: `Bearer ${testToken}`,
                },
            },
        });

        try {
            const tools = await client.tools();
            expect(tools.consult_nymph_wisdom).toBeDefined();
            expect(tools.absorb_nymph_wisdom).toBeDefined();
            expect(tools.my_nymph_impression).toBeDefined();

            const consultTool = tools.consult_nymph_wisdom;
            expect(consultTool).toBeDefined();
            expect(consultTool?.execute).toBeDefined();

            if (consultTool?.execute) {
                const consultResult = (await consultTool.execute(
                    {
                        prompt: "Smoke test question",
                    },
                    { toolCallId: "test-call-1", messages: [], context: undefined },
                )) as { content?: Array<{ text?: string }> };

                expect(consultResult.content?.[0]?.text).toContain(`sender: ${testUserId}`);
                expect(consultResult.content?.[0]?.text).toContain("nick: Nymph");
                expect(consultResult.content?.[0]?.text).toContain(`room: ${testUserId}`);
            }

            // 2. Call absorb_nymph_wisdom via AI SDK tool execute
            const dbSpy = spyOn(connection, "isDatabaseConnected").mockReturnValue(false);
            try {
                const absorbTool = tools.absorb_nymph_wisdom;
                expect(absorbTool).toBeDefined();
                expect(absorbTool?.execute).toBeDefined();

                if (absorbTool?.execute) {
                    const absorbResult = (await absorbTool.execute(
                        { query: "smoke query" },
                        { toolCallId: "test-call-2", messages: [], context: undefined },
                    )) as { content?: Array<{ text?: string }> };

                    expect(absorbResult.content?.[0]?.text).toContain("Database connection is not ready");
                }
            } finally {
                dbSpy.mockRestore();
            }
        } finally {
            await client.close();
            app.stop();
        }
    });
});
