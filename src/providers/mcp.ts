import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { PlatformName } from "../types/provider";
import type {
    BasePlatformProvider,
    MessageCallback,
    CommandCallback,
    ChatContext,
} from "../types/provider";
import type { McpProviderParams } from "../types/mcp";
import { server as defaultServer, type HttpServer } from "../routes";
import { queryKnowledgeDocuments } from "../agents/tools/knowledge-docs";
import { findAndTouchMcpToken } from "../databases/models/mcp-token";
import { getUserProfile, type IUserProfile } from "../databases/models/user-profile";

export class McpProvider implements BasePlatformProvider {
    readonly name: PlatformName = PlatformName.MCP;
    readonly enabled: boolean;

    #path: string;
    #server: HttpServer;
    #messageCallbacks: MessageCallback[] = [];
    #commandCallbacks: CommandCallback[] = [];

    constructor(params?: McpProviderParams) {
        this.#path = params?.path ?? "/mcp";
        this.#server = params?.server ?? defaultServer;
        this.enabled = params?.enabled ?? true;
    }

    async start(): Promise<void> {
        if (!this.enabled) return;

        this.#server.all(this.#path, async ({ request, set }) => {
            const token = this.extractToken(request);
            if (!token) {
                set.status = 401;
                return new Response(JSON.stringify({ error: "Unauthorized: Missing MCP authentication token" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const tokenDoc = await findAndTouchMcpToken(token);
            if (!tokenDoc) {
                set.status = 401;
                return new Response(JSON.stringify({ error: "Unauthorized: Invalid MCP authentication token" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const userId = tokenDoc.userId;
            const profile = await getUserProfile(userId);
            if (!profile) {
                set.status = 401;
                return new Response(JSON.stringify({ error: "Unauthorized: User profile not found" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const mcpServer = this.createMcpServer(userId, profile);
            const transport = new WebStandardStreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
            });
            await mcpServer.connect(transport);
            return transport.handleRequest(request);
        });

        console.info(`[McpProvider] MCP route registered at ${this.#path}`);
    }

    private extractToken(request: Request): string | null {
        const authHeaderToken = this.extractAuthHeaderToken(request.headers.get("authorization"));
        if (authHeaderToken) {
            return authHeaderToken;
        }

        const xMcpToken = request.headers.get("x-mcp-token") || request.headers.get("x-token");
        if (xMcpToken?.trim()) {
            return xMcpToken.trim();
        }

        try {
            const url = new URL(request.url);
            const queryToken =
                url.searchParams.get("token") ||
                url.searchParams.get("apiKey") ||
                url.searchParams.get("auth");
            if (queryToken?.trim()) {
                return queryToken.trim();
            }
        } catch {
            // ignore url parse error
        }

        return null;
    }

    private extractAuthHeaderToken(authHeader: string | null): string | null {
        if (!authHeader) return null;

        const params = authHeader.trim().split(/\s+/);
        if (params.length !== 2) return null;

        const [rawScheme, secret] = params;
        if (rawScheme?.toUpperCase() !== "BEARER" || !secret) return null;

        return secret;
    }

    async stop(): Promise<void> {
        // Stateless transport requires no teardown
    }

    onMessage(cb: MessageCallback): void {
        this.#messageCallbacks.push(cb);
    }

    onCommand(cb: CommandCallback): void {
        this.#commandCallbacks.push(cb);
    }

    async sendText(_roomId: string, _content: string): Promise<void> {
        // Responses are handled synchronously during tool call dispatch
    }

    createMcpServer(userId: string, profile: IUserProfile): McpServer {
        const server = new McpServer({
            name: "nymph",
            version: "1.0.0",
        });

        // 1. consult_nymph_wisdom: Dispatches message to provider.onMessage callbacks
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
                },
            },
            async ({ prompt }) => {
                try {
                    let replyText = "";

                    const ctx: ChatContext = {
                        platformName: PlatformName.MCP,
                        roomId: userId,
                        sender: {
                            id: userId,
                            nickname: profile.nickname,
                        },
                        type: "text",
                        content: prompt,
                        reply: async (text: string) => {
                            replyText = text;
                        },
                    };

                    for (const cb of this.#messageCallbacks) {
                        await cb(ctx);
                    }

                    return {
                        content: [
                            {
                                type: "text",
                                text: replyText || "Nymph processed your request with no output.",
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    console.error("[McpProvider] consult_nymph_wisdom error:", error);
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

        // 2. absorb_nymph_wisdom: Direct query to Nymph's knowledge base
        server.registerTool(
            "absorb_nymph_wisdom",
            {
                title: "Absorb Nymph Wisdom",
                description:
                    "Directly query and absorb Nymph's engineering knowledge base for historical troubleshooting solutions, architecture decisions, and code snippets.",
                inputSchema: {
                    query: z
                        .string()
                        .describe(
                            "Search keywords or technical questions to look up directly in Nymph's knowledge base",
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
                    console.error("[McpProvider] absorb_nymph_wisdom error:", error);
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

        // 3. my_nymph_impression: Get Nymph's impression and profile of the current token holder
        server.registerTool(
            "my_nymph_impression",
            {
                title: "My Nymph Impression",
                description:
                    "Get Nymph's impression and profile information of the current MCP token holder (including userId, nickname, email, and avatar_hash).",
                inputSchema: {},
            },
            async () => {
                try {
                    const data = {
                        userId,
                        nickname: profile.nickname,
                        email: profile.email,
                        avatar_hash: profile.avatar_hash,
                    };

                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(data, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    console.error("[McpProvider] my_nymph_impression error:", error);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Error retrieving Nymph impression: ${msg}`,
                            },
                        ],
                        isError: true,
                    };
                }
            },
        );

        return server;
    }
}
