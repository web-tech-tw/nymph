import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getMcpServerStatuses, type McpServerStatus } from "./mcp";

export interface ToolItemDescriptor {
    name: string;
    description: string;
    source: string;
    rawName?: string;
}

/**
 * Extracts a readable parameter schema structure from a Zod schema, AI SDK schema, or JSON Schema.
 */
export function extractSchemaDetails(toolInstance: unknown): Record<string, unknown> {
    if (!toolInstance || typeof toolInstance !== "object") {
        return { type: "object", properties: {} };
    }

    const instance = toolInstance as Record<string, unknown>;
    const schema = instance.inputSchema || instance.parameters;

    if (!schema || typeof schema !== "object") {
        return { type: "object", properties: {} };
    }

    // 1. Direct jsonSchema property (e.g. @ai-sdk/mcp tool schema)
    if ("jsonSchema" in schema && schema.jsonSchema && typeof schema.jsonSchema === "object") {
        return normalizeJsonSchema(schema.jsonSchema as Record<string, unknown>);
    }

    // 2. toJSONSchema function (e.g. Zod 3.x with zod-to-json-schema or Standard Schema)
    if ("toJSONSchema" in schema && typeof (schema as { toJSONSchema: unknown }).toJSONSchema === "function") {
        try {
            const result = (schema as { toJSONSchema: () => Record<string, unknown> }).toJSONSchema();
            if (result && typeof result === "object") {
                return normalizeJsonSchema(result);
            }
        } catch {
            // Fallback to manual inspection
        }
    }

    // 3. Zod Schema shape inspection
    const shapeObj = (schema as { shape?: Record<string, z.ZodTypeAny> }).shape;
    if (shapeObj && typeof shapeObj === "object") {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const [key, prop] of Object.entries(shapeObj)) {
            if (!prop || typeof prop !== "object") continue;

            const isOptional = typeof prop.isOptional === "function" ? prop.isOptional() : false;
            if (!isOptional) {
                required.push(key);
            }

            let typeName = "any";
            let targetProp = prop;
            const def = prop._def as unknown as { type?: string; typeName?: string; innerType?: z.ZodTypeAny } | undefined;
            if ((def?.type === "optional" || def?.typeName === "ZodOptional") && def.innerType) {
                targetProp = def.innerType;
            }
            const targetDef = targetProp._def as unknown as { type?: string; typeName?: string } | undefined;
            if (targetDef?.type) {
                typeName = targetDef.type;
            } else if (targetDef?.typeName) {
                typeName = targetDef.typeName.replace(/^Zod/, "").toLowerCase();
            } else if (targetProp.constructor?.name) {
                typeName = targetProp.constructor.name.replace(/^Zod/, "").toLowerCase();
            }

            properties[key] = {
                type: typeName,
                description: prop.description || targetProp.description || undefined,
            };
        }

        return {
            type: "object",
            properties,
            required: required.length > 0 ? required : undefined,
        };
    }

    return { type: "object" };
}

function normalizeJsonSchema(raw: Record<string, unknown>): Record<string, unknown> {
    const cleanProperties: Record<string, unknown> = {};
    if (raw.properties && typeof raw.properties === "object") {
        for (const [k, v] of Object.entries(raw.properties as Record<string, Record<string, unknown>>)) {
            if (v && typeof v === "object") {
                cleanProperties[k] = {
                    type: v.type || "any",
                    description: v.description,
                    default: v.default,
                    enum: Array.isArray(v.enum) ? v.enum : undefined,
                };
            }
        }
    }
    return {
        type: raw.type || "object",
        properties: cleanProperties,
        required: Array.isArray(raw.required) && raw.required.length > 0 ? raw.required : undefined,
    };
}

/**
 * Creates the `discover_tools` tool for discovering and searching registered tools.
 */
export function toolDiscoverTools(getTools: () => ToolSet | Record<string, unknown>) {
    return tool({
        description:
            "Discover and search available tools registered in the system. Use this to find capabilities by keyword or server origin.",
        inputSchema: z.object({
            query: z
                .string()
                .optional()
                .describe("Keyword to search tool names, descriptions, or function purpose"),
            server: z
                .string()
                .optional()
                .describe("Filter by MCP server name (e.g. 'firecrawl', 'github') or 'builtin' for native tools"),
        }),
        execute: async ({ query, server }) => {
            try {
                const allTools = getTools();
                const queryLower = query ? query.toLowerCase().trim() : "";
                const serverFilter = server ? server.trim().toLowerCase() : "";

                const toolItems: ToolItemDescriptor[] = Object.entries(allTools).map(([name, toolObj]) => {
                    const desc =
                        (toolObj && typeof toolObj === "object" && "description" in toolObj && typeof toolObj.description === "string"
                            ? toolObj.description
                            : "") || "";

                    const isBuiltin =
                        name === "currentDateTime" ||
                        name === "knowledgeDocs" ||
                        name === "discover_tools" ||
                        name === "discoverTools" ||
                        name === "get_tool_info" ||
                        name === "getToolInfo" ||
                        name === "inspect_mcp_servers" ||
                        name === "inspectMcpServers";

                    let source = "builtin";
                    let rawName: string | undefined = undefined;

                    if (!isBuiltin && name.includes("_")) {
                        const parts = name.split("_");
                        const serverName = parts[0] || "mcp";
                        source = `mcp:${serverName}`;
                        rawName = parts.slice(1).join("_");
                    }

                    return {
                        name,
                        rawName,
                        description: desc,
                        source,
                    };
                });

                const matched = toolItems.filter((item) => {
                    if (queryLower) {
                        const inName = item.name.toLowerCase().includes(queryLower);
                        const inDesc = item.description.toLowerCase().includes(queryLower);
                        const inRaw = item.rawName ? item.rawName.toLowerCase().includes(queryLower) : false;
                        if (!inName && !inDesc && !inRaw) {
                            return false;
                        }
                    }

                    if (serverFilter) {
                        if (serverFilter === "builtin") {
                            if (item.source !== "builtin") return false;
                        } else {
                            const targetPrefix = `mcp:${serverFilter}`;
                            if (item.source !== targetPrefix && item.source !== serverFilter) {
                                return false;
                            }
                        }
                    }

                    return true;
                });

                if (matched.length === 0) {
                    return JSON.stringify({
                        total: 0,
                        tools: [],
                        message: "No tools matched your search criteria.",
                    });
                }

                return JSON.stringify({
                    total: matched.length,
                    tools: matched,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return JSON.stringify({ error: `Failed to discover tools: ${message}` });
            }
        },
    });
}

/**
 * Creates the `get_tool_info` tool for inspecting detailed parameter schemas of a specific tool.
 */
export function toolGetToolInfo(getTools: () => ToolSet | Record<string, unknown>) {
    return tool({
        description:
            "Inspect the detailed parameter schema, required fields, and description for a specific tool before calling it.",
        inputSchema: z.object({
            tool_name: z
                .string()
                .describe("The exact name of the tool to inspect (e.g. 'knowledgeDocs', 'firecrawl_scrape')"),
        }),
        execute: async ({ tool_name }) => {
            try {
                const allTools = getTools();
                const target = tool_name.trim();
                const targetLower = target.toLowerCase();

                let foundEntry: [string, unknown] | undefined = undefined;

                for (const [name, toolObj] of Object.entries(allTools)) {
                    if (name === target || name.toLowerCase() === targetLower) {
                        foundEntry = [name, toolObj];
                        break;
                    }
                    if (name.includes("_") && name.toLowerCase().endsWith(`_${targetLower}`)) {
                        foundEntry = [name, toolObj];
                        break;
                    }
                }

                if (!foundEntry) {
                    return JSON.stringify({
                        error: `Tool "${target}" was not found. Use "discover_tools" to list available tools.`,
                    });
                }

                const [name, toolObj] = foundEntry;
                const desc =
                    (toolObj && typeof toolObj === "object" && "description" in toolObj && typeof toolObj.description === "string"
                        ? toolObj.description
                        : "") || "";

                const isBuiltin =
                    name === "currentDateTime" ||
                    name === "knowledgeDocs" ||
                    name === "discover_tools" ||
                    name === "discoverTools" ||
                    name === "get_tool_info" ||
                    name === "getToolInfo" ||
                    name === "inspect_mcp_servers" ||
                    name === "inspectMcpServers";

                let source = "builtin";
                if (!isBuiltin && name.includes("_")) {
                    const serverName = name.split("_")[0] || "mcp";
                    source = `mcp:${serverName}`;
                }

                const parameters = extractSchemaDetails(toolObj);

                return JSON.stringify({
                    name,
                    description: desc,
                    source,
                    parameters,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return JSON.stringify({ error: `Failed to inspect tool "${tool_name}": ${message}` });
            }
        },
    });
}

/**
 * Creates the `inspect_mcp_servers` tool for inspecting MCP server health, connection status, and tools.
 */
export function toolInspectMcpServers(getStatuses: () => McpServerStatus[] = getMcpServerStatuses) {
    return tool({
        description:
            "Inspect the connection status, transport type, health, and available tools of configured Model Context Protocol (MCP) servers.",
        inputSchema: z.object({
            server_name: z
                .string()
                .optional()
                .describe("Optional specific MCP server name to inspect (e.g. 'firecrawl', 'github')"),
        }),
        execute: async ({ server_name }) => {
            try {
                const statuses = getStatuses();

                if (server_name) {
                    const target = server_name.trim().toLowerCase();
                    const single = statuses.find((s) => s.name.toLowerCase() === target);
                    if (!single) {
                        const available = statuses.map((s) => s.name).join(", ") || "None";
                        return JSON.stringify({
                            error: `MCP server "${server_name}" not found. Available servers: ${available}`,
                        });
                    }
                    return JSON.stringify(single);
                }

                return JSON.stringify({
                    total: statuses.length,
                    servers: statuses,
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return JSON.stringify({ error: `Failed to inspect MCP servers: ${message}` });
            }
        },
    });
}
