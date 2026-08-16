import { ToolLoopAgent, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent } from "../types/agent.ts";
import type { ChatContext } from "../types/provider.ts";

export class Chat implements ChatAgent {
    private agent: ToolLoopAgent;
    private systemPrompt: string;

    constructor(params: ChatAgentParams) {
        this.agent = new ToolLoopAgent({
            model: params.model,
            tools: params.toolSet,
        });
        this.systemPrompt = params.systemPrompt;
    }

    private buildMessages(ctx: ChatContext): ModelMessage[] {
        return [
            {
                role: "system",
                content: this.systemPrompt,
            },
            {
                role: "user",
                content: ctx.content,
            }
        ];
    }

    async replyMessage(ctx: ChatContext): Promise<string> {
        const result = await this.agent.generate({
            messages: this.buildMessages(ctx)
        });
        return result.content.reduce((acc: string, c) => {
            if ("text" in c) {
                return acc + c.text;
            }
            return acc;
        }, "");
    }
}
