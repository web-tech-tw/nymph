import { ToolLoopAgent, APICallError, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent, ReplyMessageOptions } from "../types/agent";
import type { ChatContext } from "../types/provider";
import { getHistoryMessages, saveChatMessage, type IToolCallRecord } from "../databases/models/message";
import { formatUserProfileContext, formatReplyToTag } from "../utils/prompts";
import { readReceivedImage } from "../utils/media";
import { extractArxivUrls, formatArxivPaperTag, sanitizeArxivPaperTags } from "../utils/arxiv";
import { sanitizeChatReply, estimateTokens } from "../utils/text";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getActiveToolRegistry } from "./tools";

/**
 * Estimates token count for a ModelMessage.
 */
export function estimateMessageTokens(message: ModelMessage): number {
    if (typeof message.content === "string") {
        return estimateTokens(message.content);
    }
    if (Array.isArray(message.content)) {
        let total = 0;
        for (const part of message.content) {
            if ("text" in part && typeof part.text === "string") {
                total += estimateTokens(part.text);
            } else if ("image" in part) {
                total += 1600;
            } else if ("args" in part) {
                total += estimateTokens(JSON.stringify(part.args ?? {}));
            } else if ("result" in part) {
                const res = typeof part.result === "string" ? part.result : JSON.stringify(part.result ?? {});
                total += estimateTokens(res);
            } else {
                total += estimateTokens(JSON.stringify(part));
            }
        }
        return total;
    }
    return 0;
}

/**
 * Prunes messages to fit within a given token budget while maintaining tool-call/result pairs.
 */
export function pruneMessagesForBudget(messages: ModelMessage[], budget: number): ModelMessage[] {
    const systemMessages = messages.filter((m) => m.role === "system");
    let systemTokens = 0;
    for (const sm of systemMessages) {
        systemTokens += estimateMessageTokens(sm);
    }

    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    const remainingBudget = budget - systemTokens;
    if (remainingBudget <= 0 || nonSystemMessages.length === 0) {
        return [...systemMessages, nonSystemMessages[nonSystemMessages.length - 1]].filter(Boolean);
    }

    const totalNonSystemTokens = nonSystemMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    if (totalNonSystemTokens <= remainingBudget) {
        return messages;
    }

    // Step 1: Compress older tool-results (leaving the latest tool turn untouched)
    const compressedNonSystem = nonSystemMessages.map((msg, idx) => {
        if (idx >= nonSystemMessages.length - 2 && msg.role === "tool") {
            return msg;
        }
        if (msg.role === "tool" && Array.isArray(msg.content)) {
            const newContent = msg.content.map((part) => {
                if (part.type === "tool-result") {
                    const resStr = typeof part.result === "string" ? part.result : JSON.stringify(part.result ?? {});
                    const est = estimateTokens(resStr);
                    if (est > 50) {
                        return {
                            ...part,
                            result: `[輸出已省略，原約 ${est} tokens]`,
                        };
                    }
                }
                return part;
            });
            return { ...msg, content: newContent } as ModelMessage;
        }
        return msg;
    });

    const compressedTokens = compressedNonSystem.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    if (compressedTokens <= remainingBudget) {
        return [...systemMessages, ...compressedNonSystem];
    }

    // Step 2: Group messages into atomic units to strictly preserve tool-call and tool-result pairs
    const units: ModelMessage[][] = [];
    let currentUnit: ModelMessage[] = [];

    for (let i = 0; i < compressedNonSystem.length; i++) {
        const msg = compressedNonSystem[i];
        if (msg.role === "user") {
            if (currentUnit.length > 0) {
                units.push(currentUnit);
                currentUnit = [];
            }
            currentUnit.push(msg);
        } else {
            currentUnit.push(msg);
        }
    }
    if (currentUnit.length > 0) {
        units.push(currentUnit);
    }

    // Collect units from newest to oldest
    const keptUnits: ModelMessage[][] = [];
    let accumulatedTokens = 0;

    for (let i = units.length - 1; i >= 0; i--) {
        const unit = units[i];
        const unitTokens = unit.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
        if (keptUnits.length === 0 || accumulatedTokens + unitTokens <= remainingBudget) {
            keptUnits.unshift(unit);
            accumulatedTokens += unitTokens;
        } else {
            break;
        }
    }

    return [...systemMessages, ...keptUnits.flat()];
}

/**
 * Handles errors occurring during chat agent execution.
 * Returns an appropriate user-facing error message or attempts self-healing retry.
 */
export async function handleChatError(
    err: unknown,
    ctx: ChatContext,
    retryFn?: (options?: ReplyMessageOptions) => Promise<string>,
): Promise<string> {
    const isApiError =
        err instanceof APICallError ||
        (err != null && typeof err === "object" && (err as { name?: string }).name === "AI_APICallError");
    const statusCode = isApiError
        ? (err as { statusCode?: number }).statusCode
        : (err != null && typeof err === "object" && "statusCode" in err ? (err as { statusCode?: number }).statusCode : undefined);
    const message = (err != null && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string")
        ? (err as { message: string }).message
        : String(err);

    // 1. 400 Context Length Exceeded: attempt self-healing retry once with aggressive prune
    if (statusCode === 400 && /context_length|maximum context|context window/i.test(message)) {
        if (retryFn) {
            console.warn(`[Chat] Context limit exceeded, retrying with aggressive pruning for ${ctx.platformName}:${ctx.roomId}`);
            try {
                return await retryFn({ aggressivePrune: true });
            } catch (retryErr) {
                console.error("[Chat] Self-healing retry failed:", retryErr);
            }
        }
        return "⚠️ 對話內容已超出模型長度限制，請嘗試開啟新話題或討論串。";
    }

    // 2. 401 / 403 Authentication / Authorization
    if (statusCode === 401 || statusCode === 403) {
        return "⚠️ 模型服務授權失敗（HTTP 401/403），請通知管理員檢查 API 金鑰。";
    }

    // 3. 429 Rate Limit or 5xx Server Error: delayed retry
    if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
        if (retryFn) {
            console.warn(`[Chat] API error ${statusCode}, waiting 2s before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
                return await retryFn();
            } catch (retryErr) {
                console.error("[Chat] Backoff retry failed:", retryErr);
            }
        }
        return "⚠️ 模型服務暫時繁忙或連線不穩定，請稍後再試。";
    }

    // 4. Default fallback
    return "⚠️ 處理訊息時發生錯誤，請稍後再試。";
}

export class Chat implements ChatAgent {
    private agent: ToolLoopAgent;

    constructor(params: ChatAgentParams) {
        const contextLimit = Number(Bun.env.MODEL_CONTEXT_LIMIT) || 131_072;
        const maxOutput = Number(Bun.env.MODEL_MAX_OUTPUT) || 8_192;
        const safety = Number(Bun.env.MODEL_SAFETY_MARGIN) || 8_192;
        const budget = contextLimit - maxOutput - safety;

        this.agent = new ToolLoopAgent({
            model: params.model,
            instructions: params.instructions,
            tools: params.toolSet,
            providerOptions: params.providerOptions,
            prepareStep: async ({ messages }) => {
                return {
                    messages: pruneMessagesForBudget(messages, budget),
                };
            },
        });
    }

    private buildContext(ctx: ChatContext): string {
        let content = formatUserProfileContext(ctx.content, ctx.sender);
        if (ctx.replyTo) {
            content += `\n${formatReplyToTag(ctx.replyTo)}`;
        }
        return content;
    }

    private async buildMessages(ctx: ChatContext, options?: ReplyMessageOptions): Promise<ModelMessage[]> {
        const sessionId = `${ctx.platformName}:${ctx.roomId}`;
        const historyLimit = options?.aggressivePrune ? 2 : 20;
        const historyMessages = await getHistoryMessages(sessionId, historyLimit);

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
        } else {
            // Deterministic trigger: detected arxiv URLs force the agent to read them via firecrawl
            const arxivUrls = extractArxivUrls(ctx.content);
            if (arxivUrls.length > 0) {
                userContent = `${sanitizeArxivPaperTags(this.buildContext(ctx))}\n${formatArxivPaperTag(arxivUrls)}`;
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

    async replyMessage(ctx: ChatContext, options?: ReplyMessageOptions): Promise<string> {
        const messages = await this.buildMessages(ctx, options);
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

    const reasoningEffort = Bun.env.OPENAI_REASONING_EFFORT?.trim();

    return new Chat({
        model: provider(Bun.env.OPENAI_MODEL || ""),
        instructions,
        toolSet: tools,
        providerOptions: reasoningEffort
            ? { "openai-compatible": { reasoningEffort } }
            : undefined,
    });
}

