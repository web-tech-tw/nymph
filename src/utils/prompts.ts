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

