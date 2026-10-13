import { describe, expect, it } from "bun:test";
import type { ModelMessage } from "ai";
import { PlatformName, type ChatContext } from "../types/provider";
import type { ReplyMessageOptions } from "../types/agent";
import {
    createChatAgent,
    Chat,
    createOpenAICompatibleProvider,
    stripReasoningContentFromMessages,
    estimateMessageTokens,
    pruneMessagesForBudget,
    handleChatError,
} from "./chat";

describe("createChatAgent", () => {
    it("should instantiate Chat with OpenAI-compatible provider", async () => {
        const agent = await createChatAgent();
        expect(agent).toBeInstanceOf(Chat);
    });
});

describe("stripReasoningContentFromMessages", () => {
    it("should strip reasoning_content and reasoning from assistant messages", () => {
        const input: Record<string, unknown> = {
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Hello!" },
                {
                    role: "assistant",
                    content: "Hi there!",
                    reasoning_content: "User said hello, respond politely.",
                    reasoning: "Some other reasoning field.",
                },
                { role: "user", content: "How are you?" },
            ],
        };

        const result = stripReasoningContentFromMessages(input);

        expect(result.model).toBe("openai/gpt-oss-120b");
        const messages = result.messages as Array<Record<string, unknown>>;
        expect(messages).toHaveLength(4);

        // System and user messages are unchanged
        expect(messages[0]).toEqual({ role: "system", content: "You are a helpful assistant." });
        expect(messages[1]).toEqual({ role: "user", content: "Hello!" });
        expect(messages[3]).toEqual({ role: "user", content: "How are you?" });

        // Assistant message has reasoning fields stripped
        expect(messages[2]).toEqual({ role: "assistant", content: "Hi there!" });
        expect("reasoning_content" in (messages[2] ?? {})).toBe(false);
        expect("reasoning" in (messages[2] ?? {})).toBe(false);
    });

    it("should return original args if messages is not an array", () => {
        const input: Record<string, unknown> = { model: "test", prompt: "hello" };
        const result = stripReasoningContentFromMessages(input);
        expect(result).toBe(input);
    });

    it("should handle non-object items in messages gracefully", () => {
        const input: Record<string, unknown> = {
            messages: [null, undefined, "string-message", { role: "assistant", content: "ok", reasoning_content: "foo" }],
        };
        const result = stripReasoningContentFromMessages(input);
        const messages = result.messages as Array<unknown>;
        expect(messages[0]).toBeNull();
        expect(messages[1]).toBeUndefined();
        expect(messages[2]).toBe("string-message");
        expect(messages[3]).toEqual({ role: "assistant", content: "ok" });
    });
});

describe("createOpenAICompatibleProvider options", () => {
    it("should instantiate provider with stripReasoningContent enabled by default", () => {
        const provider = createOpenAICompatibleProvider();
        expect(provider).toBeDefined();
        const model = provider("test-model");
        expect(model).toBeDefined();
    });

    it("should allow disabling stripReasoningContent via option", () => {
        const provider = createOpenAICompatibleProvider({ stripReasoningContent: false });
        expect(provider).toBeDefined();
    });
});

describe("pruneMessagesForBudget & estimateMessageTokens", () => {
    it("should estimate tokens for text and multipart messages", () => {
        const textMsg: ModelMessage = { role: "user", content: "hello world" };
        expect(estimateMessageTokens(textMsg)).toBeGreaterThan(0);

        const multiPartMsg: ModelMessage = {
            role: "assistant",
            content: [
                { type: "text", text: "calling tool" },
                { type: "tool-call", toolCallId: "call_1", toolName: "search", args: { q: "test" } },
            ],
        };
        expect(estimateMessageTokens(multiPartMsg)).toBeGreaterThan(0);
    });

    it("should leave messages intact if within budget", () => {
        const messages: ModelMessage[] = [
            { role: "system", content: "system instructions" },
            { role: "user", content: "hello" },
            { role: "assistant", content: "world" },
        ];
        const pruned = pruneMessagesForBudget(messages, 10000);
        expect(pruned).toEqual(messages);
    });

    it("should compress older tool-results when exceeding budget", () => {
        const longOutput = "x".repeat(2000);
        const messages: ModelMessage[] = [
            { role: "system", content: "system" },
            { role: "user", content: "call tool" },
            {
                role: "assistant",
                content: [{ type: "tool-call", toolCallId: "c1", toolName: "scrape", args: {} }],
            },
            {
                role: "tool",
                content: [{ type: "tool-result", toolCallId: "c1", toolName: "scrape", result: longOutput }],
            },
            { role: "assistant", content: "tool finished" },
            { role: "user", content: "new question" },
        ];

        // Set budget small enough that long tool output exceeds it, but compressed fits
        const budget = 300;
        const pruned = pruneMessagesForBudget(messages, budget);

        expect(pruned.length).toBeGreaterThan(0);
        expect(pruned[0].role).toBe("system");

        // The tool result should have been compressed to omit text
        const toolMsg = pruned.find((m) => m.role === "tool");
        if (toolMsg && Array.isArray(toolMsg.content)) {
            const part = toolMsg.content[0] as { type: string; result?: unknown };
            expect(typeof part.result === "string" && part.result.includes("[輸出已省略")).toBe(true);
        }
    });

    it("should strictly preserve tool-call and tool-result pairs when dropping turns", () => {
        const messages: ModelMessage[] = [
            { role: "system", content: "system" },
            { role: "user", content: "turn 1" },
            {
                role: "assistant",
                content: [{ type: "tool-call", toolCallId: "c1", toolName: "tool1", args: {} }],
            },
            {
                role: "tool",
                content: [{ type: "tool-result", toolCallId: "c1", toolName: "tool1", result: "ok" }],
            },
            { role: "assistant", content: "turn 1 answer" },
            { role: "user", content: "turn 2" },
            {
                role: "assistant",
                content: [{ type: "tool-call", toolCallId: "c2", toolName: "tool2", args: {} }],
            },
            {
                role: "tool",
                content: [{ type: "tool-result", toolCallId: "c2", toolName: "tool2", result: "ok" }],
            },
            { role: "assistant", content: "turn 2 answer" },
        ];

        // Very small budget: will drop turn 1
        const budget = 50;
        const pruned = pruneMessagesForBudget(messages, budget);

        // System message must remain
        expect(pruned[0].role).toBe("system");

        // Must NOT have orphaned tool-result or orphaned tool-call
        const toolCalls = new Set<string>();
        const toolResults = new Set<string>();

        for (const msg of pruned) {
            if (msg.role === "assistant" && Array.isArray(msg.content)) {
                for (const p of msg.content) {
                    if (p.type === "tool-call") toolCalls.add(p.toolCallId);
                }
            }
            if (msg.role === "tool" && Array.isArray(msg.content)) {
                for (const p of msg.content) {
                    if (p.type === "tool-result") toolResults.add(p.toolCallId);
                }
            }
        }

        expect(toolCalls).toEqual(toolResults);
    });

    describe("handleChatError", () => {
        const fakeCtx: ChatContext = {
            platformName: PlatformName.Discord,
            roomId: "123",
            sender: { id: "u1", nickname: "User" },
            type: "text",
            content: "test",
            reply: async () => {},
        };

        it("should retry with aggressivePrune when encountering 400 context_length", async () => {
            const err = { name: "AI_APICallError", statusCode: 400, message: "context_length_exceeded" };
            let retriedWithAggressivePrune = false;
            const res = await handleChatError(err, fakeCtx, async (opts?: ReplyMessageOptions) => {
                if (opts?.aggressivePrune) {
                    retriedWithAggressivePrune = true;
                    return "healed response";
                }
                return "regular";
            });

            expect(retriedWithAggressivePrune).toBe(true);
            expect(res).toBe("healed response");
        });

        it("should return clear context length limit message when retry also fails", async () => {
            const err = { name: "AI_APICallError", statusCode: 400, message: "context_length_exceeded" };
            const res = await handleChatError(err, fakeCtx, async () => {
                throw new Error("still exceeded");
            });

            expect(res).toContain("對話內容已超出模型長度限制");
        });

        it("should return auth error for 401/403 without retrying", async () => {
            const err = { name: "AI_APICallError", statusCode: 401, message: "Unauthorized" };
            let retryCalled = false;
            const res = await handleChatError(err, fakeCtx, async () => {
                retryCalled = true;
                return "";
            });

            expect(retryCalled).toBe(false);
            expect(res).toContain("授權失敗");
        });

        it("should return fallback for general errors", async () => {
            const err = new Error("Network blip");
            const res = await handleChatError(err, fakeCtx);
            expect(res).toContain("處理訊息時發生錯誤");
        });
    });
});



