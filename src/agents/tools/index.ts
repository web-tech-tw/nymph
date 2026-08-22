import type { ToolSet } from "ai";
import { toolCurrentDateTime } from "./current-datetime";
import { toolKnowledgeDocs } from "./knowledge-docs";
import { toolSearchChatHistory } from "./search-chat-history";
import { loadMcpTools, closeMcpClients, getMcpServerStatuses, getMcpServerStatus, type McpServerStatus } from "./mcp";
import {
    toolDiscoverTools,
    toolGetToolInfo,
    toolInspectMcpServers,
    extractSchemaDetails,
} from "./tool-perception";

export {
    toolCurrentDateTime,
    toolKnowledgeDocs,
    toolSearchChatHistory,
    toolDiscoverTools,
    toolGetToolInfo,
    toolInspectMcpServers,
    extractSchemaDetails,
    loadMcpTools,
    closeMcpClients,
    getMcpServerStatuses,
    getMcpServerStatus,
    type McpServerStatus,
};

let activeToolRegistry: ToolSet = {};

/**
 * Returns the currently active registry of all tools.
 */
export function getActiveToolRegistry(): ToolSet {
    return activeToolRegistry;
}

export const defaultTools: ToolSet = {
    currentDateTime: toolCurrentDateTime(),
    knowledgeDocs: toolKnowledgeDocs(),
    searchChatHistory: toolSearchChatHistory(),
    discoverTools: toolDiscoverTools(() => activeToolRegistry),
    getToolInfo: toolGetToolInfo(() => activeToolRegistry),
    inspectMcpServers: toolInspectMcpServers(),
};

/**
 * Load default built-in tools merged with configured MCP server tools and perception meta-tools.
 */
export async function getAllTools(
    mcpConfigs?: Parameters<typeof loadMcpTools>[0],
    mcpFilePath?: string,
): Promise<ToolSet> {
    const mcpTools = await loadMcpTools(mcpConfigs, mcpFilePath);

    const tools: ToolSet = {
        currentDateTime: toolCurrentDateTime(),
        knowledgeDocs: toolKnowledgeDocs(),
        searchChatHistory: toolSearchChatHistory(),
        discoverTools: toolDiscoverTools(() => activeToolRegistry),
        getToolInfo: toolGetToolInfo(() => activeToolRegistry),
        inspectMcpServers: toolInspectMcpServers(),
        ...mcpTools,
    };

    activeToolRegistry = tools;
    return tools;
}

