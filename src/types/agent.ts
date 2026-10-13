import type { ToolSet, LanguageModel, ToolLoopAgent } from "ai";
import type { ChatContext } from "./provider";

export type ChatAgentParams = {
    model: LanguageModel;
    toolSet?: ToolSet;
    instructions: string;
    providerOptions?: ConstructorParameters<typeof ToolLoopAgent>[0]["providerOptions"];
};

export interface ReplyMessageOptions {
    aggressivePrune?: boolean;
}

export interface ChatAgent {
    replyMessage(ctx: ChatContext, options?: ReplyMessageOptions): Promise<string>;
}
