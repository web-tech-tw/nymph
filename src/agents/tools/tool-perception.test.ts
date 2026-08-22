import { describe, expect, test } from "bun:test";
import { tool } from "ai";
import { z } from "zod";
import {
    toolDiscoverTools,
    toolGetToolInfo,
    toolInspectMcpServers,
    extractSchemaDetails,
} from "./tool-perception";
import { getAllTools, getActiveToolRegistry } from "./index";
import type { McpServerStatus } from "./mcp";

type AnyAsyncFn = (input: unknown) => Promise<string>;

describe("Tool Perception Meta-Tools", () => {
    const dummyKnowledgeTool = tool({
        description: "Search internal technical knowledge base",
        inputSchema: z.object({
            query: z.string().describe("Search keywords"),
            limit: z.number().optional().describe("Max items to return"),
        }),
        execute: async ({ query }) => `Knowledge for ${query}`,
    });

    const dummyCalculateTool = tool({
        description: "Calculate mathematical formulas and expressions",
        inputSchema: z.object({
            formula: z.string().describe("Mathematical formula string"),
        }),
        execute: async ({ formula }) => `Result of ${formula}`,
    });

    const dummyMcpTool = tool({
        description: "Search repositories on GitHub",
        inputSchema: z.object({
            query: z.string().describe("Search query"),
            sort: z.enum(["stars", "forks", "updated"]).optional().describe("Sort field"),
        }),
        execute: async ({ query }) => `Repos for ${query}`,
    });

    const mockToolMap: Record<string, unknown> = {
        currentDateTime: { description: "Get current date and time" },
        knowledgeDocs: dummyKnowledgeTool,
        calculateFormula: dummyCalculateTool,
        github_search_repos: dummyMcpTool,
    };

    const mockMcpStatuses: McpServerStatus[] = [
        {
            name: "github",
            transport: "stdio",
            command: "npx -y @modelcontextprotocol/server-github",
            enabled: true,
            required: false,
            connected: true,
            toolCount: 1,
            discoveredCount: 1,
            tools: ["github_search_repos"],
        },
        {
            name: "firecrawl",
            transport: "http",
            url: "https://mcp.firecrawl.dev/v2/mcp",
            enabled: true,
            required: false,
            connected: false,
            toolCount: 0,
            discoveredCount: 0,
            tools: [],
            error: "Connection timed out after 10s",
        },
    ];

    describe("extractSchemaDetails", () => {
        test("should extract properties and required fields from Zod schema", () => {
            const schema = extractSchemaDetails(dummyKnowledgeTool);
            expect(schema.type).toBe("object");
            const properties = schema.properties as Record<string, { type: string; description?: string }>;
            expect(properties.query).toBeDefined();
            expect(properties.query?.type).toBe("string");
            expect(properties.query?.description).toBe("Search keywords");
            expect(properties.limit).toBeDefined();

            const required = schema.required as string[];
            expect(required).toContain("query");
            expect(required).not.toContain("limit");
        });

        test("should extract properties from jsonSchema format", () => {
            const mockMcpToolObj = {
                description: "Mock MCP tool",
                inputSchema: {
                    jsonSchema: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "Target URL" },
                            maxDepth: { type: "number", default: 2 },
                        },
                        required: ["url"],
                    },
                },
            };

            const schema = extractSchemaDetails(mockMcpToolObj);
            expect(schema.type).toBe("object");
            const properties = schema.properties as Record<string, { type: string; description?: string; default?: unknown }>;
            expect(properties.url).toBeDefined();
            expect(properties.url?.type).toBe("string");
            expect(properties.url?.description).toBe("Target URL");
            expect(properties.maxDepth?.default).toBe(2);
            expect(schema.required).toEqual(["url"]);
        });
    });

    describe("discover_tools", () => {
        const discoverTool = toolDiscoverTools(() => mockToolMap);

        test("should list all tools when no query or filter is provided", async () => {
            const res = (await (discoverTool.execute as AnyAsyncFn)({})) as string;
            const parsed = JSON.parse(res);
            expect(parsed.total).toBe(4);
            expect(parsed.tools.map((t: { name: string }) => t.name)).toContain("knowledgeDocs");
            expect(parsed.tools.map((t: { name: string }) => t.name)).toContain("calculateFormula");
            expect(parsed.tools.map((t: { name: string }) => t.name)).toContain("github_search_repos");
        });

        test("should filter tools by query keyword in name and description", async () => {
            const res = (await (discoverTool.execute as AnyAsyncFn)({ query: "formula" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.total).toBe(1);
            expect(parsed.tools[0].name).toBe("calculateFormula");
            expect(parsed.tools[0].source).toBe("builtin");
        });

        test("should filter tools by server origin (builtin vs mcp server)", async () => {
            const builtinRes = (await (discoverTool.execute as AnyAsyncFn)({ server: "builtin" })) as string;
            const builtinParsed = JSON.parse(builtinRes);
            expect(builtinParsed.total).toBe(3);

            const mcpRes = (await (discoverTool.execute as AnyAsyncFn)({ server: "github" })) as string;
            const mcpParsed = JSON.parse(mcpRes);
            expect(mcpParsed.total).toBe(1);
            expect(mcpParsed.tools[0].name).toBe("github_search_repos");
            expect(mcpParsed.tools[0].source).toBe("mcp:github");
        });

        test("should return empty message when no tools match criteria", async () => {
            const res = (await (discoverTool.execute as AnyAsyncFn)({ query: "non_existent_xyz_tool" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.total).toBe(0);
            expect(parsed.message).toContain("No tools matched");
        });
    });

    describe("get_tool_info", () => {
        const getToolInfo = toolGetToolInfo(() => mockToolMap);

        test("should return parameter schema details for an existing tool", async () => {
            const res = (await (getToolInfo.execute as AnyAsyncFn)({ tool_name: "knowledgeDocs" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.name).toBe("knowledgeDocs");
            expect(parsed.description).toBe("Search internal technical knowledge base");
            expect(parsed.source).toBe("builtin");
            expect(parsed.parameters.type).toBe("object");
            expect(parsed.parameters.properties.query.type).toBe("string");
            expect(parsed.parameters.required).toContain("query");
        });

        test("should find MCP tool by suffix or exact name", async () => {
            const res = (await (getToolInfo.execute as AnyAsyncFn)({ tool_name: "search_repos" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.name).toBe("github_search_repos");
            expect(parsed.source).toBe("mcp:github");
            expect(parsed.parameters.properties.query).toBeDefined();
        });

        test("should return error when tool is not found", async () => {
            const res = (await (getToolInfo.execute as AnyAsyncFn)({ tool_name: "unknownTool" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.error).toContain("was not found");
        });
    });

    describe("inspect_mcp_servers", () => {
        const inspectTool = toolInspectMcpServers(() => mockMcpStatuses);

        test("should list all MCP servers when server_name is omitted", async () => {
            const res = (await (inspectTool.execute as AnyAsyncFn)({})) as string;
            const parsed = JSON.parse(res);
            expect(parsed.total).toBe(2);
            expect(parsed.servers.find((s: { name: string }) => s.name === "github").connected).toBe(true);
            expect(parsed.servers.find((s: { name: string }) => s.name === "firecrawl").connected).toBe(false);
            expect(parsed.servers.find((s: { name: string }) => s.name === "firecrawl").error).toContain("timed out");
        });

        test("should return single MCP server details when server_name is provided", async () => {
            const res = (await (inspectTool.execute as AnyAsyncFn)({ server_name: "github" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.name).toBe("github");
            expect(parsed.transport).toBe("stdio");
            expect(parsed.tools).toContain("github_search_repos");
        });

        test("should return error when specified MCP server is not found", async () => {
            const res = (await (inspectTool.execute as AnyAsyncFn)({ server_name: "non_existent_server" })) as string;
            const parsed = JSON.parse(res);
            expect(parsed.error).toContain("not found");
        });
    });

    describe("getAllTools integration", () => {
        test("should include perception tools and populate activeToolRegistry", async () => {
            const allTools = await getAllTools([]);
            expect(allTools.currentDateTime).toBeDefined();
            expect(allTools.knowledgeDocs).toBeDefined();
            expect(allTools.discoverTools).toBeDefined();
            expect(allTools.getToolInfo).toBeDefined();
            expect(allTools.inspectMcpServers).toBeDefined();

            const registry = getActiveToolRegistry();
            expect(Object.keys(registry)).toEqual(Object.keys(allTools));
        });
    });
});
