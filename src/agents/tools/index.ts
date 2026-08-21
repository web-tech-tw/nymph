import { toolCurrentDateTime } from "./current-datetime";
import { toolKnowledgeDocs } from "./knowledge-docs";
import { loadMcpTools, closeMcpClients } from "./mcp";

export { toolCurrentDateTime, toolKnowledgeDocs, loadMcpTools, closeMcpClients };

export const defaultTools = {
    currentDateTime: toolCurrentDateTime(),
    knowledgeDocs: toolKnowledgeDocs(),
};

/**
 * Load default built-in tools merged with configured MCP server tools.
 */
export async function getAllTools() {
    const mcpTools = await loadMcpTools();
    return {
        ...defaultTools,
        ...mcpTools,
    };
}

