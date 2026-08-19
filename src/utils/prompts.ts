import type { ModelMessage } from "ai";

export const ANTHROPIC_CACHE_CONTROL = {
    anthropic: { cacheControl: { type: "ephemeral" as const } },
};

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
