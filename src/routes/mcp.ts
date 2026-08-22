import { Elysia } from "elysia";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { createChatAgent } from "../agents/chat";
import { queryKnowledgeDocuments } from "../agents/tools/knowledge-docs";
import type { ChatAgent } from "../types/agent";
import { PlatformName } from "../types/provider";

export type AgentFactory = (sessionId: string) => Promise<ChatAgent> | ChatAgent;

export interface NymphMcpServerOptions {
    agentFactory?: AgentFactory;
}

/**
 * Creates and configures the Nymph MCP Server instance.
 */
export function createNymphMcpServer(options?: NymphMcpServerOptions): McpServer {
    const server = new McpServer({
        name: "nymph",
        version: "1.0.0",
    });

    const getAgent: AgentFactory =
        options?.agentFactory ??
        (async () => {
            return await createChatAgent();
        });

    // 1. consult_nymph_wisdom: AI mediated response powered by Nymph's agent
    server.registerTool(
        "consult_nymph_wisdom",
        {
            title: "Consult Nymph Wisdom",
            description:
                "Consult Nymph's AI wisdom for reasoning, technical advice, code assistance, and solutions.",
            inputSchema: {
                prompt: z
                    .string()
                    .describe("The question, task, or message to consult Nymph with"),
                sessionId: z
                    .string()
                    .optional()
                    .describe(
                        "Optional session identifier to maintain conversation history across multiple turns (default: 'global')",
                    ),
            },
        },
        async ({ prompt, sessionId }) => {
            try {
                const targetSession = sessionId?.trim() || "global";
                const agent = await getAgent(targetSession);
                const reply = await agent.replyMessage({
                    platformName: PlatformName.MCP,
                    roomId: targetSession,
                    sender: {
                        id: "mcp-client",
                        nickname: "MCP Client",
                    },
                    content: prompt,
                    reply: async () => {},
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: reply || "Nymph processed your request with no output.",
                        },
                    ],
                };
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error("[MCP] consult_nymph_wisdom error:", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error consulting Nymph wisdom: ${msg}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // 2. absorb_nymph_wisdom: Direct query to MongoDB knowledge collection
    server.registerTool(
        "absorb_nymph_wisdom",
        {
            title: "Absorb Nymph Wisdom",
            description:
                "Directly query the MongoDB engineering knowledge base for historical troubleshooting solutions, architecture decisions, and code snippets.",
            inputSchema: {
                query: z
                    .string()
                    .describe(
                        "Search keywords or technical questions to look up directly in the MongoDB knowledge base",
                    ),
                category: z
                    .string()
                    .optional()
                    .describe(
                        "Optional technical category filter (e.g. 'Frontend', 'Backend', 'DevOps', 'Tools & Best Practices', 'Security & Auth', 'AI & Machine Learning')",
                    ),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(20)
                    .default(5)
                    .optional()
                    .describe("Maximum number of knowledge slices to return (default: 5)"),
            },
        },
        async ({ query, category, limit = 5 }) => {
            try {
                const result = await queryKnowledgeDocuments({
                    query,
                    category,
                    limit: limit ?? 5,
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: result,
                        },
                    ],
                };
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error("[MCP] absorb_nymph_wisdom error:", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error querying knowledge base: ${msg}`,
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    return server;
}

/**
 * Creates a WebStandardStreamableHTTPServerTransport for MCP requests.
 */
export function createMcpTransport(): WebStandardStreamableHTTPServerTransport {
    return new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
}

/**
 * Elysia plugin for the /mcp endpoint.
 */
export const mcpRoutes = new Elysia().all("/mcp", async ({ request }) => {
    const server = createNymphMcpServer();
    const transport = createMcpTransport();
    await server.connect(transport);
    return transport.handleRequest(request);
});
