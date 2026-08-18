import type { ToolSet, LanguageModel } from "ai";
import type { ChatContext } from "./provider";

export type ChatAgentParams = {
    model: LanguageModel;
    toolSet?: ToolSet;
    systemPrompt: string;
};

export interface ChatAgent {
    replyMessage(ctx: ChatContext): Promise<string>;
}
