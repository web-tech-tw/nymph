import type { ModelMessage, ToolLoopAgent } from "ai";

export type AgentProviderOptions = NonNullable<ConstructorParameters<typeof ToolLoopAgent>[0]>["providerOptions"];

export const ANTHROPIC_CACHE_CONTROL = {
    anthropic: { cacheControl: { type: "ephemeral" as const } },
};

/**
 * Parse Anthropic thinking configuration from JSON string or object.
 * Supports configurations like:
 * - '{"type": "enabled", "budgetTokens": 2048}'
 * - '{"type": "adaptive"}'
 * - '{"type": "disabled"}'
 */
export function parseAnthropicThinking(
    thinkingInput?: string | Record<string, any>,
): Record<string, any> | undefined {
    if (!thinkingInput) {
        return undefined;
    }

    if (typeof thinkingInput === "object") {
        return thinkingInput;
    }

    if (typeof thinkingInput !== "string") {
        return undefined;
    }

    const trimmed = thinkingInput.trim();
    if (!trimmed) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== "object" || parsed === null) {
            console.warn(`[Config] Anthropic thinking config must be a JSON object, received: ${trimmed}`);
            return undefined;
        }

        return parsed as Record<string, any>;
    } catch (error) {
        console.warn(`[Config] Failed to parse Anthropic thinking config as JSON: "${trimmed}"`, error);
        return undefined;
    }
}

/**
 * Build Anthropic provider options with optional thinking and cache control
 */
export function buildAnthropicProviderOptions(options?: {
    thinking?: string | Record<string, any>;
    cacheControl?: boolean;
}): AgentProviderOptions {
    if (!options) {
        return undefined;
    }

    const parsedThinking = parseAnthropicThinking(options.thinking);
    if (!options.cacheControl && !parsedThinking) {
        return undefined;
    }

    return {
        anthropic: {
            ...(options.cacheControl ? { cacheControl: { type: "ephemeral" } } : {}),
            ...(parsedThinking ? { thinking: parsedThinking } : {}),
        },
    };
}

/**
 * Apply Anthropic dynamic prompt caching breakpoint to conversation history messages
 * By default, attaches an ephemeral cache breakpoint to the last message in history
 */
export function applyPromptCaching(
    historyMessages: ModelMessage[],
): ModelMessage[] {
    if (!historyMessages.length) {
        return historyMessages;
    }

    return historyMessages.map((msg, index) => {
        if (index === historyMessages.length - 1) {
            return {
                ...msg,
                providerOptions: {
                    ...msg.providerOptions,
                    ...ANTHROPIC_CACHE_CONTROL,
                },
            };
        }
        return msg;
    });
}

/**
 * Formats a user profile XML tag from user profile metadata.
 */
export function formatUserProfileTag(
    sender?: { id?: string; nickname?: string } | null,
): string {
    if (!sender || (!sender.id && !sender.nickname)) {
        return "";
    }
    return `<user_profile id="${sender.id ?? ""}" nickname="${sender.nickname ?? ""}" />`;
}

/**
 * Formats an image XML tag for image-type messages.
 */
export function formatImageMessageTag(id: string): string {
    return `<image id="${id}">User sent an image.</image>`;
}

/**
 * Appends a user profile XML tag to the message content if sender metadata is available.
 */
export function formatUserProfileContext(
    content: string,
    sender?: { id?: string; nickname?: string } | null,
): string {
    const tag = formatUserProfileTag(sender);
    return tag ? `${content}\n${tag}` : content;
}

/** Max length of the persistent reply breadcrumb preview (single line). */
const REPLY_BREADCRUMB_MAX_LENGTH = 60;

/** Max length of the full referenced message content injected into the current turn. */
const REPLY_TO_TAG_MAX_LENGTH = 500;

/**
 * Formats a short one-line breadcrumb identifying the message being replied to.
 * This snippet is persisted with the message content, so it must stay small.
 */
export function formatReplyBreadcrumb(author: string, content: string): string {
    const preview = content.replace(/\s+/g, " ").trim().slice(0, REPLY_BREADCRUMB_MAX_LENGTH);
    const suffix = preview.length < content.replace(/\s+/g, " ").trim().length ? "…" : "";
    const quote = preview ? `"${preview}${suffix}"` : "(無文字內容)";
    return `回覆 ${author}: ${quote}`;
}

/**
 * Formats a referenced-message XML tag carrying the full (length-capped) content.
 * Only attached to the current turn's prompt, never stored in chat history.
 */
export function formatReplyToTag(replyTo: { author: string; content: string }): string {
    const content = replyTo.content.trim().slice(0, REPLY_TO_TAG_MAX_LENGTH);
    return `<referenced_message author="${replyTo.author}">${content}</referenced_message>`;
}
