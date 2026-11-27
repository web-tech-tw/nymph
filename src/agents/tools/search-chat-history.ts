import { tool } from "ai";
import { z } from "zod";
import {
    searchChatHistoryMessages,
    type SearchChatHistoryQueryOptions,
    type ChatHistorySearchResult,
} from "../../databases/models/message";

export type SearchChatHistoryFetcher = (
    options: SearchChatHistoryQueryOptions,
) => Promise<ChatHistorySearchResult | string>;

export function toolSearchChatHistory(
    customFetcher?: SearchChatHistoryFetcher,
    boundSessionId?: string,
) {
    const normalizedBoundSession = boundSessionId?.trim() || undefined;

    const executeSearch = async (params: {
        query?: string;
        role?: "all" | "user" | "assistant";
        sessionId?: string;
        limit?: number;
    }): Promise<string> => {
        const { query = "", role = "all", sessionId, limit = 10 } = params;
        const effectiveSessionId = normalizedBoundSession ?? sessionId;
        try {
            if (customFetcher) {
                const customResult = await customFetcher({
                    query,
                    role,
                    sessionId: effectiveSessionId,
                    limit,
                });
                if (typeof customResult === "string") {
                    return customResult;
                }
                return JSON.stringify(customResult, null, 2);
            }

            const result = await searchChatHistoryMessages({
                query,
                role,
                sessionId: effectiveSessionId,
                limit,
            });
            return JSON.stringify(result, null, 2);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return JSON.stringify(
                {
                    total: 0,
                    messages: [],
                    error: `Failed to search chat history: ${message}`,
                },
                null,
                2,
            );
        }
    };

    if (normalizedBoundSession) {
        return tool({
            description:
                "Search past messages in the current conversation history by keyword or role.",
            inputSchema: z.object({
                query: z
                    .string()
                    .optional()
                    .default("")
                    .describe("Keyword to search in past messages. If empty, returns the most recent messages."),
                role: z
                    .enum(["all", "user", "assistant"])
                    .optional()
                    .default("all")
                    .describe("Filter by sender role: 'all' (both user and assistant), 'user', or 'assistant'."),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(50)
                    .optional()
                    .default(10)
                    .describe("Maximum number of matching messages to return (default: 10, max: 50)."),
            }),
            execute: async ({ query = "", role = "all", limit = 10 }) =>
                executeSearch({ query, role, limit }),
        });
    }

    return tool({
        description:
            "Search past messages in the conversation history by keyword or role.",
        inputSchema: z.object({
            query: z
                .string()
                .optional()
                .default("")
                .describe("Keyword to search in past messages. If empty, returns the most recent messages."),
            role: z
                .enum(["all", "user", "assistant"])
                .optional()
                .default("all")
                .describe("Filter by sender role: 'all' (both user and assistant), 'user', or 'assistant'."),
            sessionId: z
                .string()
                .optional()
                .describe("Optional session ID (e.g. 'discord:123456' or 'line:c123456') to filter messages by room/channel."),
            limit: z
                .number()
                .int()
                .min(1)
                .max(50)
                .optional()
                .default(10)
                .describe("Maximum number of matching messages to return (default: 10, max: 50)."),
        }),
        execute: async ({ query = "", role = "all", sessionId, limit = 10 }) =>
            executeSearch({ query, role, sessionId, limit }),
    });
}
