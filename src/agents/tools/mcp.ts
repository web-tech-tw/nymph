import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpHttpTransportConfig {
    type: "http" | "sse";
    url: string;
    headers?: Record<string, string>;
}

export interface McpStdioTransportConfig {
    type: "stdio";
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
}

export type McpTransportConfig = McpHttpTransportConfig | McpStdioTransportConfig;

export interface McpServerConfig {
    name: string;
    enabled?: boolean;
    required?: boolean;
    transport: McpTransportConfig;
    maxRetries?: number;
    max_retries?: number;
    retryDelay?: number;
    retry_delay?: number;
    startupTimeout?: number;
    startup_timeout?: number;
    requestTimeout?: number;
    request_timeout?: number;
}

const activeMcpClients: MCPClient[] = [];

/**
 * Reads and parses MCP server configurations strictly from a TOML file.
 */
export async function getMcpServerConfigsFromFile(filePath = Bun.env.MCP_CONFIG_PATH || "./mcp.toml"): Promise<McpServerConfig[]> {

    const file = Bun.file(filePath);
    const exists = await file.exists();

    if (!exists) {
        return [];
    }

    try {
        const content = await file.text();
        const parsed = Bun.TOML.parse(content);
        const parsedObj = parsed as Record<string, unknown>;
        const configs: McpServerConfig[] = [];

        const serversSource = parsedObj.mcp_servers || parsedObj.mcpServers || parsedObj.mcp || parsedObj;

        if (Array.isArray(serversSource)) {
            for (const item of serversSource) {
                if (item && typeof item === "object") {
                    configs.push(parseRawServerConfig(item.name || "unnamed", item as Record<string, unknown>));
                }
            }
        } else if (serversSource && typeof serversSource === "object") {
            for (const [serverName, serverDef] of Object.entries(serversSource)) {
                if (!serverDef || typeof serverDef !== "object") {
                    continue;
                }
                configs.push(parseRawServerConfig(serverName, serverDef as Record<string, unknown>));
            }
        }

        return configs;
    } catch (error) {
        console.error(`[MCP] Failed to read or parse '${filePath}':`, error);
        return [];
    }
}

function parseRawServerConfig(serverName: string, rawDef: Record<string, unknown>): McpServerConfig {
    const enabled = rawDef.enabled !== false;
    const required = rawDef.required === true;
    const maxRetries = typeof rawDef.max_retries === "number" ? rawDef.max_retries : (typeof rawDef.maxRetries === "number" ? rawDef.maxRetries : 2);
    const retryDelay = typeof rawDef.retry_delay === "number" ? rawDef.retry_delay : (typeof rawDef.retryDelay === "number" ? rawDef.retryDelay : 1.5);

    let transport: McpTransportConfig;

    if (rawDef.transport && typeof rawDef.transport === "object") {
        transport = rawDef.transport as McpTransportConfig;
    } else if (typeof rawDef.url === "string") {
        const transportType = rawDef.type === "sse" ? "sse" : "http";
        transport = {
            type: transportType,
            url: rawDef.url,
            headers: rawDef.headers as Record<string, string> | undefined,
        };
    } else {
        transport = {
            type: "stdio",
            command: typeof rawDef.command === "string" ? rawDef.command : "node",
            args: Array.isArray(rawDef.args) ? (rawDef.args as string[]) : undefined,
            cwd: typeof rawDef.cwd === "string" ? rawDef.cwd : undefined,
            env: rawDef.env as Record<string, string> | undefined,
        };
    }

    return {
        name: serverName,
        enabled,
        required,
        transport,
        maxRetries,
        retryDelay,
        startupTimeout: typeof rawDef.startup_timeout === "number" ? rawDef.startup_timeout : (rawDef.startupTimeout as number | undefined),
        requestTimeout: typeof rawDef.request_timeout === "number" ? rawDef.request_timeout : (rawDef.requestTimeout as number | undefined),
    };
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(errorMsg));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) {
            clearTimeout(timer);
        }
    });
}

/**
 * Connect to a single MCP server with retry logic and exponential backoff.
 */
async function connectServerWithRetry(config: McpServerConfig): Promise<Record<string, unknown>> {
    const serverName = config.name;

    if (config.enabled === false) {
        console.info(`[MCP] Server '${serverName}' is disabled in configuration. Skipping.`);
        return {};
    }

    const maxRetries = Math.max(0, config.maxRetries ?? config.max_retries ?? 2);
    const attempts = maxRetries + 1;
    const baseDelayMs = Math.max(100, (config.retryDelay ?? config.retry_delay ?? 1.5) * 1000);
    const timeoutSec = config.startupTimeout ?? config.startup_timeout ?? 10;
    const timeoutMs = Math.max(500, timeoutSec * 1000);

    let lastError: Error | unknown = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
        let client: MCPClient | undefined;
        try {
            console.info(`[MCP] Connecting to server '${serverName}' (attempt ${attempt + 1}/${attempts}, timeout ${timeoutSec}s)...`);

            const connectPromise = (async () => {
                let mcpClient: MCPClient;
                if (config.transport.type === "http" || config.transport.type === "sse") {
                    mcpClient = await createMCPClient({
                        transport: {
                            type: config.transport.type,
                            url: config.transport.url,
                            headers: config.transport.headers,
                        },
                    });
                } else if (config.transport.type === "stdio") {
                    const stdioTransport = new StdioClientTransport({
                        command: config.transport.command,
                        args: config.transport.args,
                        cwd: config.transport.cwd,
                        env: config.transport.env,
                    });
                    mcpClient = await createMCPClient({
                        transport: stdioTransport,
                    });
                } else {
                    throw new Error("Unsupported transport type.");
                }

                client = mcpClient;
                const tools = await mcpClient.tools();
                return { client: mcpClient, tools };
            })();

            const result = await withTimeout(
                connectPromise,
                timeoutMs,
                `Connection timed out after ${timeoutSec}s`,
            );

            client = result.client;
            const tools = result.tools;
            const toolCount = Object.keys(tools).length;

            activeMcpClients.push(client);

            console.info(`[MCP] Server '${serverName}' connected successfully with ${toolCount} tool(s).`);

            const scopedTools: Record<string, unknown> = {};
            for (const [toolName, toolObj] of Object.entries(tools)) {
                const key = `${serverName}_${toolName}`;
                scopedTools[key] = toolObj;
            }
            return scopedTools;
        } catch (error) {
            lastError = error;
            if (client) {
                try {
                    await client.close();
                } catch {
                    // ignore cleanup error on failure
                }
            }

            const errorMsg = error instanceof Error ? error.message : String(error);

            if (attempt < attempts - 1) {
                const delayMs = baseDelayMs * Math.pow(2, attempt);
                console.warn(
                    `[MCP] Failed to connect to MCP server '${serverName}' (attempt ${attempt + 1}/${attempts}): ${errorMsg}. Retrying in ${(delayMs / 1000).toFixed(1)}s...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    const finalErrorMsg = lastError instanceof Error ? lastError.message : String(lastError);

    if (config.required) {
        console.error(`[MCP] Error: Required MCP server '${serverName}' failed to connect after ${attempts} attempt(s): ${finalErrorMsg}`);
        throw lastError;
    }

    console.warn(
        `[MCP] Warning: Optional MCP server '${serverName}' failed to connect after ${attempts} attempt(s): ${finalErrorMsg}. Skipping server to allow graceful startup.`,
    );

    return {};
}

/**
 * Initialize all configured MCP clients from TOML file and return a combined Record of tools.
 */
export async function loadMcpTools(
    configs?: McpServerConfig[],
    filePath = Bun.env.MCP_CONFIG_PATH || "./mcp.toml",
): Promise<Record<string, unknown>> {

    const serverConfigs = configs ?? (await getMcpServerConfigsFromFile(filePath));
    const combinedTools: Record<string, unknown> = {};

    if (serverConfigs.length === 0) {
        return combinedTools;
    }

    console.info(`[MCP] Initializing ${serverConfigs.length} MCP server client(s) from ${filePath}...`);

    for (const config of serverConfigs) {
        const tools = await connectServerWithRetry(config);
        Object.assign(combinedTools, tools);
    }

    return combinedTools;
}

/**
 * Gracefully close all active MCP clients.
 */
export async function closeMcpClients(): Promise<void> {
    if (activeMcpClients.length === 0) {
        return;
    }
    console.info(`[MCP] Closing ${activeMcpClients.length} active MCP client(s)...`);
    await Promise.allSettled(
        activeMcpClients.map(async (client) => {
            try {
                await client.close();
            } catch (err) {
                console.error("[MCP] Error closing MCP client:", err);
            }
        }),
    );
    activeMcpClients.length = 0;
}
