import { describe, expect, test } from "bun:test";
import { camelToSnakeCase, snakeToCamelCase, sliceContent } from "./text";

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
});
