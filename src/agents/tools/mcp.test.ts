import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { getMcpServerConfigsFromFile, loadMcpTools, closeMcpClients, type McpServerConfig } from "./mcp";

describe("MCP Configuration & Filtering", () => {
    describe("TOML Config Parsing", () => {
        test("should parse allowed_tools and disallowed_tools from TOML", async () => {
            const tomlContent = `
[mcp_servers.test_server]
enabled = true
type = "http"
url = "https://mcp.example.com/sse"
allowed_tools = ["tool1", "tool2"]
disallowed_tools = ["tool3"]
`;
            const tmpPath = `/tmp/mcp_test_${Date.now()}.toml`;
            await Bun.write(tmpPath, tomlContent);

            try {
                const configs = await getMcpServerConfigsFromFile(tmpPath);
                expect(configs.length).toBe(1);
                expect(configs[0]?.name).toBe("test_server");
                expect(configs[0]?.allowedTools).toEqual(["tool1", "tool2"]);
                expect(configs[0]?.disallowedTools).toEqual(["tool3"]);
            } finally {
                const file = Bun.file(tmpPath);
                if (await file.exists()) {
                    await Bun.write(tmpPath, "");
                }
            }
        });

        test("should parse camelCase allowedTools and disallowedTools from TOML", async () => {
            const tomlContent = `
[mcp_servers.test_server]
enabled = true
type = "http"
url = "https://mcp.example.com/sse"
allowedTools = ["tool_a", "tool_b"]
disallowedTools = ["tool_c"]
`;
            const tmpPath = `/tmp/mcp_test_camel_${Date.now()}.toml`;
            await Bun.write(tmpPath, tomlContent);

            try {
                const configs = await getMcpServerConfigsFromFile(tmpPath);
                expect(configs.length).toBe(1);
                expect(configs[0]?.name).toBe("test_server");
                expect(configs[0]?.allowedTools).toEqual(["tool_a", "tool_b"]);
                expect(configs[0]?.disallowedTools).toEqual(["tool_c"]);
            } finally {
                const file = Bun.file(tmpPath);
                if (await file.exists()) {
                    await Bun.write(tmpPath, "");
                }
            }
        });
    });

    describe("Tool Filtering via loadMcpTools", () => {
        const mockClose = mock(() => Promise.resolve());
        const mockTools = mock(() =>
            Promise.resolve({
                tool_a: { name: "tool_a", description: "Tool A" },
                tool_b: { name: "tool_b", description: "Tool B" },
                tool_c: { name: "tool_c", description: "Tool C" },
            }),
        );

        beforeEach(() => {
            mock.module("@ai-sdk/mcp", () => ({
                createMCPClient: mock(() =>
                    Promise.resolve({
                        tools: mockTools,
                        close: mockClose,
                    }),
                ),
            }));
        });

        afterEach(async () => {
            await closeMcpClients();
        });

        test("should load all tools when neither allowedTools nor disallowedTools is specified", async () => {
            const configs: McpServerConfig[] = [
                {
                    name: "test_mcp",
                    enabled: true,
                    transport: {
                        type: "http",
                        url: "http://localhost:3000",
                    },
                },
            ];

            const tools = await loadMcpTools(configs);
            expect(Object.keys(tools)).toEqual(["test_mcp_tool_a", "test_mcp_tool_b", "test_mcp_tool_c"]);
        });

        test("should only include allowedTools when allowedTools is specified", async () => {
            const configs: McpServerConfig[] = [
                {
                    name: "test_mcp",
                    enabled: true,
                    transport: {
                        type: "http",
                        url: "http://localhost:3000",
                    },
                    allowedTools: ["tool_a", "tool_c"],
                },
            ];

            const tools = await loadMcpTools(configs);
            expect(Object.keys(tools)).toEqual(["test_mcp_tool_a", "test_mcp_tool_c"]);
        });

        test("should exclude disallowedTools when disallowedTools is specified", async () => {
            const configs: McpServerConfig[] = [
                {
                    name: "test_mcp",
                    enabled: true,
                    transport: {
                        type: "http",
                        url: "http://localhost:3000",
                    },
                    disallowedTools: ["tool_b"],
                },
            ];

            const tools = await loadMcpTools(configs);
            expect(Object.keys(tools)).toEqual(["test_mcp_tool_a", "test_mcp_tool_c"]);
        });

        test("should apply both allowedTools and disallowedTools when both are specified", async () => {
            const configs: McpServerConfig[] = [
                {
                    name: "test_mcp",
                    enabled: true,
                    transport: {
                        type: "http",
                        url: "http://localhost:3000",
                    },
                    allowedTools: ["tool_a", "tool_b"],
                    disallowedTools: ["tool_b"],
                },
            ];

            const tools = await loadMcpTools(configs);
            expect(Object.keys(tools)).toEqual(["test_mcp_tool_a"]);
        });

        test("should support snake_case allowed_tools and disallowed_tools properties", async () => {
            const configs: McpServerConfig[] = [
                {
                    name: "test_mcp",
                    enabled: true,
                    transport: {
                        type: "http",
                        url: "http://localhost:3000",
                    },
                    allowed_tools: ["tool_a", "tool_b"],
                    disallowed_tools: ["tool_a"],
                },
            ];

            const tools = await loadMcpTools(configs);
            expect(Object.keys(tools)).toEqual(["test_mcp_tool_b"]);
        });
    });
});
