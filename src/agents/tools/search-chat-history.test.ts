import { describe, it, expect } from "bun:test";
import { toolSearchChatHistory } from "./search-chat-history";
import type { ChatHistorySearchResult, SearchChatHistoryQueryOptions } from "../../databases/models/message";

type AnyAsyncFn = (...args: unknown[]) => Promise<unknown>;

describe("search_chat_history tool", () => {
    const mockMessages = [
        {
            turn: 1,
            role: "user",
            content: "What is the capital of France?",
            sessionId: "discord:12345",
        },
        {
            turn: 2,
            role: "assistant",
            content: "The capital of France is Paris.",
            sessionId: "discord:12345",
        },
        {
            turn: 3,
            role: "user",
            content: "My favorite anime is Hyperdimension Neptunia.",
            sessionId: "discord:12345",
        },
        {
            turn: 4,
            role: "assistant",
            content: "Neptunia is an amazing series featuring Goddesses!",
            sessionId: "discord:12345",
        },
    ];

    const createMockFetcher = (history: typeof mockMessages) => {
        return async (options: SearchChatHistoryQueryOptions): Promise<ChatHistorySearchResult> => {
            const { query = "", role = "all", sessionId, limit = 10 } = options;

            let filtered = [...history];

            if (sessionId) {
                filtered = filtered.filter((m) => m.sessionId === sessionId);
            }

            if (history.length === 0 || filtered.length === 0) {
                return {
                    total: 0,
                    messages: [],
                    message: "No conversation history available.",
                };
            }

            const roleLower = (role || "all").toLowerCase();
            if (roleLower === "user" || roleLower === "assistant") {
                filtered = filtered.filter((m) => m.role === roleLower);
            }

            const queryLower = query.trim().toLowerCase();
            if (queryLower) {
                filtered = filtered.filter((m) => m.content.toLowerCase().includes(queryLower));
            }

            if (filtered.length === 0) {
                return {
                    total: 0,
                    messages: [],
                    message: `No messages matching query '${query}' were found.`,
                };
            }

            const effectiveLimit = Math.max(1, Math.min(limit, 50));
            const trimmed = filtered.slice(-effectiveLimit);

            return {
                total: filtered.length,
                returned: trimmed.length,
                messages: trimmed,
            };
        };
    };

    it("should return empty message when history is empty", async () => {
        const tool = toolSearchChatHistory(createMockFetcher([]));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "", role: "all", limit: 10 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(0);
        expect(data.messages).toEqual([]);
        expect(data.message).toContain("No conversation history");
    });

    it("should search and return all recent messages when query is empty", async () => {
        const tool = toolSearchChatHistory(createMockFetcher(mockMessages));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "", role: "all", limit: 10 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(4);
        expect(data.returned).toBe(4);
        expect(data.messages.length).toBe(4);
    });

    it("should search messages by keyword", async () => {
        const tool = toolSearchChatHistory(createMockFetcher(mockMessages));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "Neptunia", role: "all", limit: 10 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(2);
        expect(data.returned).toBe(2);
        const contents = data.messages.map((m: { content: string }) => m.content);
        expect(contents.some((c: string) => c.includes("Hyperdimension"))).toBe(true);
        expect(contents.some((c: string) => c.includes("Goddesses"))).toBe(true);
    });

    it("should filter messages by role=user", async () => {
        const tool = toolSearchChatHistory(createMockFetcher(mockMessages));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "", role: "user", limit: 10 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(2);
        expect(data.messages.every((m: { role: string }) => m.role === "user")).toBe(true);
    });

    it("should filter messages by role=assistant with query", async () => {
        const tool = toolSearchChatHistory(createMockFetcher(mockMessages));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "Paris", role: "assistant", limit: 10 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(1);
        expect(data.messages[0].role).toBe("assistant");
        expect(data.messages[0].content).toContain("Paris");
    });

    it("should return not found message for non-matching query", async () => {
        const tool = toolSearchChatHistory(createMockFetcher(mockMessages));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "nonexistent_xyz", role: "all", limit: 10 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(0);
        expect(data.messages).toEqual([]);
        expect(data.message).toContain("No messages matching");
    });

    it("should respect limit parameter", async () => {
        const tool = toolSearchChatHistory(createMockFetcher(mockMessages));
        const res = (await (tool.execute as AnyAsyncFn)({ query: "", role: "all", limit: 2 })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(4);
        expect(data.returned).toBe(2);
        expect(data.messages.length).toBe(2);
    });

    it("should handle error in fetcher gracefully", async () => {
        const failingFetcher = async () => {
            throw new Error("DB connection timeout");
        };
        const tool = toolSearchChatHistory(failingFetcher);
        const res = (await (tool.execute as AnyAsyncFn)({ query: "test" })) as string;
        const data = JSON.parse(res);

        expect(data.total).toBe(0);
        expect(data.error).toContain("DB connection timeout");
    });
});
