import { describe, expect, it } from "bun:test";
import {
    createChatAgent,
    Chat,
    createOpenAICompatibleProvider,
    stripReasoningContentFromMessages,
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

