import { describe, expect, it } from "bun:test";
import {
    parseAnthropicThinking,
    buildAnthropicProviderOptions,
    applyPromptCaching,
    ANTHROPIC_CACHE_CONTROL,
} from "./prompts";
import type { ModelMessage } from "ai";

describe("Anthropic Thinking & Provider Options Utilities", () => {
    describe("parseAnthropicThinking", () => {
        it("should return undefined for empty or undefined inputs", () => {
            expect(parseAnthropicThinking()).toBeUndefined();
            expect(parseAnthropicThinking("")).toBeUndefined();
            expect(parseAnthropicThinking("   ")).toBeUndefined();
        });

        it("should parse valid JSON string correctly for enabled thinking", () => {
            const jsonStr = JSON.stringify({ type: "enabled", budgetTokens: 2048 });
            const result = parseAnthropicThinking(jsonStr);
            expect(result).toEqual({ type: "enabled", budgetTokens: 2048 });
        });

        it("should parse valid JSON string for adaptive thinking", () => {
            const jsonStr = JSON.stringify({ type: "adaptive" });
            const result = parseAnthropicThinking(jsonStr);
            expect(result).toEqual({ type: "adaptive" });
        });

        it("should pass through object input directly", () => {
            const obj = { type: "enabled", budgetTokens: 4096 };
            expect(parseAnthropicThinking(obj)).toEqual(obj);
        });

        it("should return undefined and warn on invalid JSON string", () => {
            const invalidStr = "{ not-a-valid-json }";
            expect(parseAnthropicThinking(invalidStr)).toBeUndefined();
        });

        it("should return undefined if parsed JSON is not an object", () => {
            expect(parseAnthropicThinking("123")).toBeUndefined();
            expect(parseAnthropicThinking("\"just a string\"")).toBeUndefined();
        });
    });

    describe("buildAnthropicProviderOptions", () => {
        it("should return undefined when no options are provided", () => {
            expect(buildAnthropicProviderOptions()).toBeUndefined();
            expect(buildAnthropicProviderOptions({})).toBeUndefined();
        });

        it("should build options with cacheControl only", () => {
            const result = buildAnthropicProviderOptions({ cacheControl: true });
            expect(result).toEqual({
                anthropic: {
                    cacheControl: { type: "ephemeral" },
                },
            });
        });

        it("should build options with thinking JSON string", () => {
            const result = buildAnthropicProviderOptions({
                thinking: "{\"type\": \"enabled\", \"budgetTokens\": 2048}",
            });
            expect(result).toEqual({
                anthropic: {
                    thinking: { type: "enabled", budgetTokens: 2048 },
                },
            });
        });

        it("should build options with both thinking and cacheControl", () => {
            const result = buildAnthropicProviderOptions({
                thinking: { type: "adaptive" },
                cacheControl: true,
            });
            expect(result).toEqual({
                anthropic: {
                    cacheControl: { type: "ephemeral" },
                    thinking: { type: "adaptive" },
                },
            });
        });
    });

    describe("applyPromptCaching", () => {
        it("should return empty array for empty history", () => {
            expect(applyPromptCaching([])).toEqual([]);
        });

        it("should attach ephemeral cache breakpoint to the last message only", () => {
            const messages: ModelMessage[] = [
                { role: "user", content: "msg1" },
                { role: "assistant", content: "msg2" },
                { role: "user", content: "msg3" },
            ];

            const result = applyPromptCaching(messages);
            expect(result).toHaveLength(3);
            expect(result[0]?.providerOptions).toBeUndefined();
            expect(result[1]?.providerOptions).toBeUndefined();
            expect(result[2]?.providerOptions).toEqual(ANTHROPIC_CACHE_CONTROL);
        });
    });
});
