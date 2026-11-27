import { ToolLoopAgent, APICallError, stepCountIs, type ModelMessage } from "ai";
import type { ChatAgentParams, ChatAgent, ReplyMessageOptions } from "../types/agent";
import { PlatformName, type ChatContext, type ReplyMetadata } from "../types/provider";
import { getHistoryMessages, saveChatMessage, type IToolCallRecord } from "../databases/models/message";
import { formatUserProfileContext, formatReplyToTag } from "../utils/prompts";
import { readReceivedImage } from "../utils/media";
import { extractArxivUrls, formatArxivPaperTag, sanitizeArxivPaperTags } from "../utils/arxiv";
import { sanitizeChatReply, estimateTokens } from "../utils/text";
import { extractQuickRepliesTag } from "../utils/line-flex";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getActiveToolRegistry } from "./tools";

const CONVERGENCE_SYSTEM_NOTICE =
    "\n\n<system_notice>回覆時限即將到達，請立即停止呼叫任何工具，直接根據目前掌握的資訊整理出完整、精簡且實用的最終回覆。</system_notice>";

/**
 * Returns platform-specific formatting instructions appended to base settings.xml.
 */
export function getPlatformFormattingInstructions(platformName?: PlatformName): string {
    switch (platformName) {
    case PlatformName.MCP:
        return [
            "<platform_formatting platform=\"MCP\">",
            "你正在透過 MCP 回覆開發者的編輯器或 CLI 用戶端，支援完整 GitHub Flavored Markdown。",
            "- 可依需要自由使用標題、清單、粗體、程式碼區塊與 Markdown 表格，以提供結構清晰、易於掃讀的技術分析。",
            "</platform_formatting>",
        ].join("\n");

    case PlatformName.LINE:
        return [
            "<platform_formatting platform=\"LINE\">",
            "CRITICAL PLATFORM RESTRICTION (LINE): LINE 不支援 Markdown 渲染、HTML 或表格。",
            "- 一般交談與說明請使用純文字與自然換行排版（可用「• 」或數字列點），不要使用 **粗體**、# 標題或 | Markdown 表格語法。",
            "- 僅在提供程式碼片段時使用 ```語言 ... ``` 程式碼區塊。",
            "- 回覆保持精簡聚焦，避免過長篇幅。",
            "- 非 arxiv_reply 卡片回覆時，可在回覆最末端選填附上一行 <quick_replies>簡短追問1|簡短追問2</quick_replies>（最多 2 個、每個 12 字以內，作為使用者下一步按鈕；不需要時可省略）。",
            "</platform_formatting>",
        ].join("\n");

    case PlatformName.Discord:
    default:
        return [
            "<platform_formatting platform=\"Discord\">",
            "CRITICAL PLATFORM RESTRICTION (Discord): Discord 不支援 HTML 與 Markdown 表格。",
            "- 嚴禁使用 Markdown 表格（絕不可使用 | 表格語法），即使使用者要求表格，也請改以乾淨的條列清單（- 或 •）搭配粗體小標呈現。",
            "- 可適度使用簡潔的清單、粗體重點、連結與標準多行程式碼區塊（```語言 ... ```），避免過度花俏排版。",
            "</platform_formatting>",
        ].join("\n");
    }
}

let cachedSettingsText: string | null = null;
let cachedSettingsMtime = -1;

async function loadSettingsInstructions(filePath = "./settings.xml"): Promise<string> {
    const file = Bun.file(filePath);
    const mtime = file.lastModified;
    if (cachedSettingsText !== null && mtime === cachedSettingsMtime) {
        return cachedSettingsText;
    }
    const text = await file.text();
    cachedSettingsText = text;
    cachedSettingsMtime = mtime;
    return text;
}

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

    // 4. Timeout / Abort
    const errorName = err != null && typeof err === "object" && "name" in err
        ? String((err as { name?: unknown }).name)
        : "";
    if (errorName === "TimeoutError" || errorName === "AbortError" || /aborted|timed?\s*out/i.test(message)) {
        return "⚠️ 思考與查證時間過長，請嘗試簡化問題或分次詢問。";
    }

    // 5. Default fallback
    return "⚠️ 處理訊息時發生錯誤，請稍後再試。";
}

export class Chat implements ChatAgent {
    private agent: ToolLoopAgent;
    private baseInstructions: string;
    private currentSoftDeadline: number | undefined;
    private convergenceTriggered = false;
    public lastTurnMetadata: ReplyMetadata = {};

    constructor(params: ChatAgentParams) {
        const contextLimit = Number(Bun.env.MODEL_CONTEXT_LIMIT) || 131_072;
        const maxOutput = Number(Bun.env.MODEL_MAX_OUTPUT) || 8_192;
        const safety = Number(Bun.env.MODEL_SAFETY_MARGIN) || 8_192;
        const budget = contextLimit - maxOutput - safety;
        const maxSteps = params.maxSteps ?? (Number(Bun.env.AGENT_MAX_STEPS) || 10);

        this.baseInstructions = params.instructions;

        this.agent = new ToolLoopAgent({
            model: params.model,
            instructions: params.instructions,
            tools: params.toolSet,
            providerOptions: params.providerOptions,
            stopWhen: stepCountIs(maxSteps),
            prepareStep: async ({ messages, stepNumber }) => {
                const prunedMessages = pruneMessagesForBudget(messages, budget);
                if (this.currentSoftDeadline !== undefined && Date.now() >= this.currentSoftDeadline) {
                    if (!this.convergenceTriggered) {
                        this.convergenceTriggered = true;
                        console.warn(
                            `[Chat] Soft deadline reached at step ${stepNumber}; setting toolChoice='none' to force convergence`,
                        );
                    }
                    // Keep tools defined (omit activeTools: []) so strict providers like Mistral
                    // do not reject requests whose history already contains tool_calls/tool messages.
                    return {
                        messages: prunedMessages,
                        toolChoice: "none",
                        instructions: `${this.baseInstructions}${CONVERGENCE_SYSTEM_NOTICE}`,
                    };
                }
                return {
                    messages: prunedMessages,
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
        const stateless = Boolean(options?.stateless ?? ctx.stateless);
        const historyLimit = options?.aggressivePrune ? 2 : 20;
        const historyMessages = stateless ? [] : await getHistoryMessages(sessionId, historyLimit);

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
            const textPayload = arxivUrls.length > 0
                ? `${sanitizeArxivPaperTags(this.buildContext(ctx))}\n${formatArxivPaperTag(arxivUrls)}`
                : this.buildContext(ctx);

            if (ctx.images && ctx.images.length > 0) {
                const imageParts: Array<{ type: "image"; image: Uint8Array }> = [];
                for (const imageId of ctx.images) {
                    const bytes = await readReceivedImage(imageId);
                    if (bytes) {
                        imageParts.push({ type: "image", image: bytes });
                    }
                }
                if (imageParts.length > 0) {
                    userContent = [
                        { type: "text", text: textPayload },
                        ...imageParts,
                    ];
                } else {
                    userContent = textPayload;
                }
            } else {
                userContent = textPayload;
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
        const softDeadlineMs = options?.softDeadlineMs ?? ctx.softDeadlineMs;
        const hardDeadlineMs =
            options?.hardDeadlineMs ??
            ctx.hardDeadlineMs ??
            (Number(Bun.env.AGENT_TIMEOUT_MS) || undefined);

        this.currentSoftDeadline = softDeadlineMs ? Date.now() + softDeadlineMs : undefined;
        this.convergenceTriggered = false;
        this.lastTurnMetadata = {};

        let result;
        let didConverge = false;
        try {
            result = await this.agent.generate({
                messages,
                ...(hardDeadlineMs ? { abortSignal: AbortSignal.timeout(hardDeadlineMs) } : {}),
            });
            didConverge = this.convergenceTriggered;
        } finally {
            this.currentSoftDeadline = undefined;
            this.convergenceTriggered = false;
        }

        // 1. Extract and log tool calls if dispatched
        const sessionId = `${ctx.platformName}:${ctx.roomId}`;
        const toolCalls: IToolCallRecord[] = (result.toolCalls || []).map((tc) => {
            const rawTc = tc as unknown as {
                args?: Record<string, unknown>;
                input?: Record<string, unknown>;
                toolCallId?: string;
            };
            return {
                toolName: tc.toolName,
                toolCallId: rawTc.toolCallId ?? (tc as { toolCallId?: string }).toolCallId,
                args: rawTc.args ?? rawTc.input,
            };
        });

        if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
                console.info(
                    `[Agent Tool] Dispatched: ${tc.toolName} (callId=${tc.toolCallId ?? "n/a"}, sessionId=${sessionId}) args=${JSON.stringify(tc.args)}`,
                );
            }
        }

        // 2. Extract final assistant text reply, strip <quick_replies> tags, and sanitize chat markup
        const { cleanText, quickReplies } = extractQuickRepliesTag(result.text);
        const reply = sanitizeChatReply(cleanText);
        this.lastTurnMetadata = {
            converged: didConverge || undefined,
            quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
        };

        const stateless = Boolean(options?.stateless ?? ctx.stateless);
        if (!stateless) {
            // 3. Save any attached images from combined multimodal turns
            if (ctx.type === "text" && ctx.images && ctx.images.length > 0) {
                for (const imageId of ctx.images) {
                    await saveChatMessage({
                        sessionId,
                        role: "user",
                        type: "image",
                        content: imageId,
                        sender: ctx.sender,
                    });
                }
            }

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

export interface CreateChatAgentOptions {
    sessionId?: string;
    platformName?: PlatformName;
    maxSteps?: number;
    hasImages?: boolean;
}

/**
 * Resolves the model ID to use for the turn.
 * Uses OPENAI_VISION_MODEL when the turn includes images and a dedicated vision model is configured.
 */
export function resolveChatModelName(options?: {
    hasImages?: boolean;
    defaultModel?: string;
    visionModel?: string;
}): string {
    const visionModel = (options?.visionModel ?? Bun.env.OPENAI_VISION_MODEL ?? "").trim();
    if (options?.hasImages && visionModel) {
        return visionModel;
    }
    return (options?.defaultModel ?? Bun.env.OPENAI_MODEL ?? "").trim();
}

/**
 * Creates a new Chat instance initialized with system settings and active tools.
 */
export async function createChatAgent(options?: CreateChatAgentOptions): Promise<Chat> {
    const provider = createOpenAICompatibleProvider();

    const baseInstructions = await loadSettingsInstructions();
    const platformInstructions = getPlatformFormattingInstructions(options?.platformName);
    const instructions = `${baseInstructions}\n\n${platformInstructions}`;

    const tools = getActiveToolRegistry(options?.sessionId);

    const reasoningEffort = Bun.env.OPENAI_REASONING_EFFORT?.trim();
    const modelName = resolveChatModelName({ hasImages: options?.hasImages });

    return new Chat({
        model: provider(modelName),
        instructions,
        toolSet: tools,
        maxSteps: options?.maxSteps,
        platformName: options?.platformName,
        providerOptions: reasoningEffort
            ? { "openai-compatible": { reasoningEffort } }
            : undefined,
    });
}

