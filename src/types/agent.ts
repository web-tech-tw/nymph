import type { ToolSet, LanguageModel, ToolLoopAgent } from "ai";
import type { ChatContext, PlatformName } from "./provider";

export type ChatAgentParams = {
    model: LanguageModel;
    toolSet?: ToolSet;
    instructions: string;
    providerOptions?: ConstructorParameters<typeof ToolLoopAgent>[0]["providerOptions"];
    maxSteps?: number;
    platformName?: PlatformName;
};

export interface ReplyMessageOptions {
    aggressivePrune?: boolean;
    softDeadlineMs?: number;
    hardDeadlineMs?: number;
    stateless?: boolean;
}

export interface ChatAgent {
    replyMessage(ctx: ChatContext, options?: ReplyMessageOptions): Promise<string>;
}
