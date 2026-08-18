import { ToolLoopAgent, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent } from "../types/agent";
import type { ChatContext } from "../types/provider";
import { getHistoryMessages, saveChatMessage } from "../databases/models/message";

export class Chat implements ChatAgent {
    private agent: ToolLoopAgent;

    constructor(params: ChatAgentParams) {
        this.agent = new ToolLoopAgent({
            model: params.model,
            instructions: params.instructions,
            tools: params.toolSet,
        });
    }

    private buildContext(ctx: ChatContext): string {
        return ctx.content;
    }

    private async buildMessages(ctx: ChatContext): Promise<ModelMessage[]> {
        const sessionId = `${ctx.platformName}:${ctx.roomId}`;
        const historyMessages = await getHistoryMessages(sessionId);

        return [
            ...historyMessages,
            {
                role: "user",
                content: this.buildContext(ctx),
            }
        ];
    }

    async replyMessage(ctx: ChatContext): Promise<string> {
        const messages = await this.buildMessages(ctx);
        const result = await this.agent.generate({
            messages,
        });

        const reply = result.content.reduce((acc: string, c) => {
            if ("text" in c) {
                return acc + c.text;
            }
            return acc;
        }, "");

        const sessionId = `${ctx.platformName}:${ctx.roomId}`;
        void saveChatMessage({
            sessionId,
            role: "user",
            content: this.buildContext(ctx),
            sender: ctx.sender,
        });

        if (reply) {
            void saveChatMessage({
                sessionId,
                role: "assistant",
                content: reply,
            });
        }

        return reply;
    }
}
