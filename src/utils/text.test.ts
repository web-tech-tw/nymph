import { describe, expect, test } from "bun:test";
import { camelToSnakeCase, snakeToCamelCase, sliceContent, sanitizeChatReply } from "./text";

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
});
