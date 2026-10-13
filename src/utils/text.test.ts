import { describe, expect, test } from "bun:test";
import {
    camelToSnakeCase,
    snakeToCamelCase,
    sliceContent,
    sanitizeChatReply,
    estimateTokens,
    truncateText,
    truncateToolResult,
} from "./text";

describe("Text Utilities", () => {
    describe("camelToSnakeCase", () => {
        test("converts camelCase to snake_case correctly", () => {
            expect(camelToSnakeCase("allowedTools")).toBe("allowed_tools");
            expect(camelToSnakeCase("maxRetries")).toBe("max_retries");
            expect(camelToSnakeCase("startupTimeout")).toBe("startup_timeout");
            expect(camelToSnakeCase("simple")).toBe("simple");
        });
    });

    describe("snakeToCamelCase", () => {
        test("converts snake_case to camelCase correctly", () => {
            expect(snakeToCamelCase("allowed_tools")).toBe("allowedTools");
            expect(snakeToCamelCase("disallowed_tools")).toBe("disallowedTools");
            expect(snakeToCamelCase("max_retries")).toBe("maxRetries");
            expect(snakeToCamelCase("retry_delay")).toBe("retryDelay");
            expect(snakeToCamelCase("startup_timeout")).toBe("startupTimeout");
            expect(snakeToCamelCase("simple")).toBe("simple");
        });

        test("converts kebab-case to camelCase correctly", () => {
            expect(snakeToCamelCase("allowed-tools")).toBe("allowedTools");
        });
    });

    describe("sliceContent", () => {
        test("returns empty array for empty string", () => {
            expect(sliceContent("")).toEqual([]);
        });

        test("returns single item if within limit", () => {
            expect(sliceContent("hello world", 100)).toEqual(["hello world"]);
        });
    });

    describe("sanitizeChatReply", () => {
        test("returns empty string for empty input", () => {
            expect(sanitizeChatReply("")).toBe("");
        });

        test("replaces <br>, <br/>, <br /> with newlines", () => {
            expect(sanitizeChatReply("line1<br>line2<br/>line3<br />line4")).toBe("line1\nline2\nline3\nline4");
        });

        test("removes retrieval citation markers like 【1†L1-L5】", () => {
            expect(sanitizeChatReply("This is sourced【1†L1-L5】 and also here【2†source】.")).toBe("This is sourced and also here.");
        });

        test("handles combination of br tags and citation markers", () => {
            const raw = "• Feature 1<br>• Feature 2【1†L1-L3】<br/>• Feature 3";
            expect(sanitizeChatReply(raw)).toBe("• Feature 1\n• Feature 2\n• Feature 3");
        });
    });

    describe("estimateTokens", () => {
        test("returns 0 for empty string", () => {
            expect(estimateTokens("")).toBe(0);
        });

        test("estimates token count correctly (~4 chars per token)", () => {
            expect(estimateTokens("abcd")).toBe(2);
            expect(estimateTokens("a".repeat(400))).toBe(101);
        });
    });

    describe("truncateText", () => {
        test("returns short text unchanged", () => {
            expect(truncateText("hello world", 100)).toBe("hello world");
        });

        test("truncates text exceeding maxTokens and appends note", () => {
            const long = "a".repeat(500);
            const truncated = truncateText(long, 50); // 50 tokens = 200 chars
            expect(truncated.length).toBeLessThan(long.length);
            expect(truncated.startsWith("a".repeat(200))).toBe(true);
            expect(truncated).toContain("[輸出已省略");
        });
    });

    describe("truncateToolResult", () => {
        test("truncates strings exceeding token limit", () => {
            const long = "x".repeat(1000);
            const res = truncateToolResult(long, 100);
            expect(typeof res).toBe("string");
            expect((res as string).length).toBeLessThan(1000);
        });

        test("truncates JSON objects exceeding token limit", () => {
            const largeObj = { data: "y".repeat(1000) };
            const res = truncateToolResult(largeObj, 100);
            expect(typeof res).toBe("string");
            expect((res as string)).toContain("[輸出已省略");
        });

        test("leaves small objects unchanged", () => {
            const smallObj = { key: "value" };
            expect(truncateToolResult(smallObj, 100)).toEqual(smallObj);
        });
    });
});

