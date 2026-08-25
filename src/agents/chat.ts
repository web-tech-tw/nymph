import { ToolLoopAgent, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent } from "../types/agent";
import type { ChatContext } from "../types/provider";
import { getHistoryMessages, saveChatMessage, type IToolCallRecord } from "../databases/models/message";
import { applyPromptCaching, buildAnthropicProviderOptions, formatUserProfileContext } from "../utils/prompts";
import { readReceivedImage } from "../utils/media";

import { createAnthropic } from "@ai-sdk/anthropic";
import { getActiveToolRegistry } from "./tools";

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
        return formatUserProfileContext(ctx.content, ctx.sender);
    }

    private async buildMessages(ctx: ChatContext): Promise<ModelMessage[]> {
        const sessionId = `${ctx.platformName}:${ctx.roomId}`;
        const historyMessages = await getHistoryMessages(sessionId);

        let userContent: ModelMessage["content"] = this.buildContext(ctx);
        if (ctx.type === "image") {
            const imageBytes = await readReceivedImage(ctx.content);
            if (imageBytes) {
                userContent = [
                    {
                        type: "image",
                        image: imageBytes,
                    },
                ];
            }
        }

        return [
            ...applyPromptCaching(historyMessages),
            {
                role: "user",
                content: userContent,
            } as ModelMessage,
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

        // 3. Session identifier scoped by platform and room for conversation persistence
        const sessionId = `${ctx.platformName}:${ctx.roomId}`;

        // 4. Save incoming user message (raw content)
        await saveChatMessage({
            sessionId,
            role: "user",
            type: ctx.type,
            content: ctx.content,
            sender: ctx.sender,
        });

        // 5. Save assistant reply along with dispatched toolCalls
        if (reply) {
            await saveChatMessage({
                sessionId,
                role: "assistant",
                type: "text",
                content: reply,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
        }

        return reply;
    }
}

/**
 * Creates a new Chat instance initialized with system settings and active tools.
 */
export async function createChatAgent(): Promise<Chat> {
    const anthropic = createAnthropic({
        apiKey: Bun.env.ANTHROPIC_API_KEY,
        baseURL: Bun.env.ANTHROPIC_BASE_URL,
    });

    const settingsFile = Bun.file("./settings.xml");
    const instructions = await settingsFile.text();

    const providerOptions = buildAnthropicProviderOptions({
        thinking: Bun.env.ANTHROPIC_THINKING,
    });

    const tools = getActiveToolRegistry();

    return new Chat({
        model: anthropic(Bun.env.ANTHROPIC_MODEL || "claude-sonnet-5"),
        instructions,
        toolSet: tools,
        providerOptions,
    });
}

