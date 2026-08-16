import type { ToolSet } from "ai";
import type { ChatContext } from "./provider";

export type ChatAgentParams = {
    model: string;
    toolSet?: ToolSet;
    systemPrompt: string;
};

export interface ChatAgent {
    replyMessage(ctx: ChatContext): Promise<string>
}
