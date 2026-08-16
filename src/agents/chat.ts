import { ToolLoopAgent } from "ai";
import type { ChatAgentParams } from "../types/agent.ts";

export const chatAgent = (params: ChatAgentParams) => {
    return new ToolLoopAgent({
        model: params.model,
        tools: {
            ...params.toolSet,
        },
    });
};
