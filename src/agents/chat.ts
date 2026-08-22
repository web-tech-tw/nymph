import { ToolLoopAgent, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent } from "../types/agent";
import type { ChatContext } from "../types/provider";
import { getHistoryMessages, saveChatMessage, type IToolCallRecord } from "../databases/models/message";
import { applyPromptCaching } from "../utils/prompts";

export class Chat implements ChatAgent {
    private agent: ToolLoopAgent;

    constructor(params: ChatAgentParams) {
        this.agent = new ToolLoopAgent({
            model: params.model,
            instructions: params.instructions,
            tools: params.toolSet,
            providerOptions: params.providerOptions,
        });
    }

    private buildContext(ctx: ChatContext): string {
        return ctx.content;
    }

    private async buildMessages(ctx: ChatContext): Promise<ModelMessage[]> {
        const sessionId = `${ctx.platformName}:${ctx.roomId}`;
        const historyMessages = await getHistoryMessages(sessionId);

        return [
            ...applyPromptCaching(historyMessages),
            {
                role: "user",
                content: this.buildContext(ctx),
            },
        ];
    }

    async replyMessage(ctx: ChatContext): Promise<string> {
        const messages = await this.buildMessages(ctx);
        const result = await this.agent.generate({
            messages,
        });

        // 1. Extract and log tool calls if dispatched
        const toolCalls: IToolCallRecord[] = (result.toolCalls || []).map((tc) => {
            const rawTc = tc as unknown as { args?: Record<string, unknown>; input?: Record<string, unknown> };
            return {
                toolName: tc.toolName,
                args: rawTc.args ?? rawTc.input,
            };
        });

        if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
                console.info(`[Agent Tool] Dispatched: ${tc.toolName} args=${JSON.stringify(tc.args)}`);
            }
        }

        // 2. Extract final assistant text reply
        const reply = result.content.reduce((acc: string, c) => {
            if ("text" in c) {
                return acc + c.text;
            }
            return acc;
        }, "");

        const sessionId = `${ctx.platformName}:${ctx.roomId}`;

        // 3. Save incoming user message
        await saveChatMessage({
            sessionId,
            role: "user",
            content: this.buildContext(ctx),
            sender: ctx.sender,
        });

        // 4. Save assistant reply along with dispatched toolCalls
        if (reply) {
            await saveChatMessage({
                sessionId,
                role: "assistant",
                content: reply,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
        }

        return reply;
    }
}
