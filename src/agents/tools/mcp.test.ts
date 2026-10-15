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

        test("should load tools when configured from TOML with snake_case allowed_tools and disallowed_tools", async () => {
            const tomlContent = `
[mcp_servers.test_mcp]
enabled = true
type = "http"
url = "https://mcp.example.com/sse"
allowed_tools = ["tool_a", "tool_b"]
disallowed_tools = ["tool_a"]
`;
            const tmpPath = `/tmp/mcp_test_snake_load_${Date.now()}.toml`;
            await Bun.write(tmpPath, tomlContent);

            try {
                const tools = await loadMcpTools(undefined, tmpPath);
                expect(Object.keys(tools)).toEqual(["test_mcp_tool_b"]);
            } finally {
                const file = Bun.file(tmpPath);
                if (await file.exists()) {
                    await Bun.write(tmpPath, "");
                }
            }
        });

        test("should normalize non-object tool execution output and protect toModelOutput", async () => {
            const mockRawExecute = mock(() => Promise.resolve("raw string result"));
            // Simulates upstream @ai-sdk/mcp's mcpToModelOutput which uses `in` operator
            const mockToModelOutput = mock(({ output }: { output: unknown }) => {
                if (output == null || typeof output !== "object" || !("content" in output)) {
                    throw new TypeError("Cannot use 'in' operator to search for 'content' in primitive");
                }
                return { type: "content", value: (output as { content: unknown }).content };
            });

            mockTools.mockImplementationOnce(() =>
                Promise.resolve({
                    tool_primitive: {
                        name: "tool_primitive",
                        description: "Tool returning primitive",
                        execute: mockRawExecute,
                        toModelOutput: mockToModelOutput,
                    },
                } as unknown as ReturnType<typeof mockTools>),
            );

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
            const wrappedTool = tools.test_mcp_tool_primitive as {
                execute: (args: Record<string, unknown>, options?: { toolCallId?: string }) => Promise<unknown>;
                toModelOutput: (options: { output: unknown }) => { type: string; value?: unknown };
            };
            expect(wrappedTool).toBeDefined();

            // 1. execute should return a normalized MCP object, not a raw string
            const execResult = (await wrappedTool.execute({}, { toolCallId: "call_abc123" })) as {
                content: Array<{ text: string }>;
            };
            expect(typeof execResult).toBe("object");
            expect(execResult).not.toBeNull();
            expect("content" in execResult).toBe(true);
            expect(Array.isArray(execResult.content)).toBe(true);
            expect(execResult.content[0]?.text).toBe("raw string result");

            // 2. toModelOutput with non-object should be shielded from TypeError
            const modelOutput = wrappedTool.toModelOutput({ output: "primitive output" });
            expect(modelOutput).toBeDefined();
            expect(modelOutput.type).toBe("content");
        });

        test("should log error with tool name and toolCallId on execute failure", async () => {
            const mockFailingExecute = mock(() => Promise.reject(new Error("tool execution exploded")));

            mockTools.mockImplementationOnce(() =>
                Promise.resolve({
                    tool_fail: {
                        name: "tool_fail",
                        description: "Tool failing",
                        execute: mockFailingExecute,
                    },
                } as unknown as ReturnType<typeof mockTools>),
            );

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
            const wrappedTool = tools.test_mcp_tool_fail as {
                execute: (args: Record<string, unknown>, options?: { toolCallId?: string }) => Promise<unknown>;
            };

            let caughtError: unknown;
            try {
                await wrappedTool.execute({}, { toolCallId: "call_fail_999" });
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError).toBeDefined();
            expect((caughtError as Error).message).toBe("tool execution exploded");
        });
    });
});

