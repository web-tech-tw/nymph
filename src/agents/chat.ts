import { ToolLoopAgent, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent } from "../types/agent";
import type { ChatContext } from "../types/provider";
import { getHistoryMessages, saveChatMessage, type IToolCallRecord } from "../databases/models/message";
import { formatUserProfileContext } from "../utils/prompts";
import { readReceivedImage } from "../utils/media";
import { sanitizeChatReply } from "../utils/text";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
            ...historyMessages,
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

        // 2. Extract final assistant text reply (using result.text to exclude reasoning parts, and sanitize chat markup)
        const reply = sanitizeChatReply(result.text);

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

export interface OpenAICompatibleProviderOptions {
    apiKey?: string;
    baseURL?: string;
    stripReasoningContent?: boolean;
}

/**
 * Strips reasoning_content and reasoning fields from assistant messages in the request body.
 * Prevents 400 Bad Request on strict OpenAI-compatible APIs (like Cerebras).
 */
export function stripReasoningContentFromMessages(args: Record<string, unknown>): Record<string, unknown> {
    if (!Array.isArray(args.messages)) {
        return args;
    }

    return {
        ...args,
        messages: args.messages.map((msg: unknown) => {
            if (
                typeof msg === "object" &&
                msg !== null &&
                "role" in msg &&
                (msg as { role?: unknown }).role === "assistant"
            ) {
                const {
                    reasoning_content: _reasoningContent,
                    reasoning: _reasoning,
                    ...rest
                } = msg as Record<string, unknown>;
                return rest;
            }
            return msg;
        }),
    };
}

/**
 * Creates an OpenAI-compatible provider instance.
 */
export function createOpenAICompatibleProvider(options?: OpenAICompatibleProviderOptions) {
    const shouldStrip = options?.stripReasoningContent ?? (Bun.env.STRIP_REASONING_CONTENT !== "false");

    return createOpenAICompatible({
        name: "openai-compatible",
        baseURL: options?.baseURL || Bun.env.OPENAI_BASE_URL || "",
        apiKey: options?.apiKey || Bun.env.OPENAI_API_KEY,
        transformRequestBody: shouldStrip ? stripReasoningContentFromMessages : undefined,
    });
}

/**
 * Creates a new Chat instance initialized with system settings and active tools.
 */
export async function createChatAgent(): Promise<Chat> {
    const provider = createOpenAICompatibleProvider();

    const settingsFile = Bun.file("./settings.xml");
    const instructions = await settingsFile.text();

    const tools = getActiveToolRegistry();

    return new Chat({
        model: provider(Bun.env.OPENAI_MODEL || ""),
        instructions,
        toolSet: tools,
    });
}

