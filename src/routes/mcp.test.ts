import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { createMCPClient } from "@ai-sdk/mcp";
import { server } from "./index";
import * as chatModule from "../agents/chat";
import type { ChatAgent } from "../types/agent";
import type { ChatContext } from "../types/provider";
import { KnowledgeModel } from "../databases/models/knowledge";
import * as connection from "../databases/connection";

describe("MCP Route /mcp", () => {
    let mockAgent: ChatAgent;
    let createAgentSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        mockAgent = {
            replyMessage: mock(async (ctx: ChatContext) => {
                return `AI reply for: ${ctx.content}`;
            }),
        } as unknown as chatModule.Chat;
        createAgentSpy = spyOn(chatModule, "createChatAgent").mockImplementation(async () => mockAgent as chatModule.Chat);
    });

    afterEach(() => {
        createAgentSpy.mockRestore();
    });

    it("should handle MCP initialize handshake", async () => {
        const res = await server.handle(
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

        expect(res.status).toBe(200);
        const text = await res.text();
        const json = JSON.parse(text);
        expect(json.jsonrpc).toBe("2.0");
        expect(json.id).toBe(1);
        expect(json.result.serverInfo.name).toBe("nymph");
    });

    it("should list consult_nymph_wisdom and absorb_nymph_wisdom tools", async () => {
        const res = await server.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
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
    });

    it("should call consult_nymph_wisdom and return AI response", async () => {
        const res = await server.handle(
            new Request("http://localhost/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 3,
                    method: "tools/call",
                    params: {
                        name: "consult_nymph_wisdom",
                        arguments: {
                            prompt: "How to use Elysia?",
                            sessionId: "test-session-123",
                        },
                    },
                }),
            }),
        );

        expect(res.status).toBe(200);
        const json = JSON.parse(await res.text());
        expect(json.result.content).toBeDefined();
        expect(json.result.content[0].text).toBe("AI reply for: How to use Elysia?");
        expect(mockAgent.replyMessage).toHaveBeenCalled();
    });

    it("should call absorb_nymph_wisdom and handle query when DB is not ready", async () => {
        const dbSpy = spyOn(connection, "isDatabaseConnected").mockReturnValue(false);

        try {
            const res = await server.handle(
                new Request("http://localhost/mcp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json, text/event-stream",
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
            const res = await server.handle(
                new Request("http://localhost/mcp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json, text/event-stream",
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

    it("should pass smoke test using Vercel AI SDK MCP Client (@ai-sdk/mcp)", async () => {
        const app = server.listen(0);
        const port = app.server?.port;
        expect(port).toBeDefined();

        const client = await createMCPClient({
            transport: {
                type: "http",
                url: `http://127.0.0.1:${port}/mcp`,
            },
        });

        try {
            const tools = await client.tools();
            expect(tools.consult_nymph_wisdom).toBeDefined();
            expect(tools.absorb_nymph_wisdom).toBeDefined();

            const consultTool = tools.consult_nymph_wisdom;
            expect(consultTool).toBeDefined();
            expect(consultTool?.execute).toBeDefined();

            if (consultTool?.execute) {
                const consultResult = (await consultTool.execute(
                    {
                        prompt: "Smoke test question",
                        sessionId: "smoke-session",
                    },
                    { toolCallId: "test-call-1", messages: [], context: undefined },
                )) as { content?: Array<{ text?: string }> };

                expect(consultResult.content?.[0]?.text).toContain("AI reply for: Smoke test question");
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
