import { describe, test, expect, mock } from "bun:test";
import { withTypingIndicator, parseSlashCommand } from "./discord";

describe("DiscordProvider helpers", () => {
    test("withTypingIndicator should refresh typing periodically and stop on completion", async () => {
        const sendTyping = mock(async () => {});
        const channel = {
            isSendable: () => true,
            sendTyping,
        };

        const result = await withTypingIndicator(
            channel,
            async () => {
                await new Promise((r) => setTimeout(r, 65));
                return "done";
            },
            25,
        );

        expect(result).toBe("done");
        const countAtCompletion = sendTyping.mock.calls.length;
        expect(countAtCompletion).toBeGreaterThanOrEqual(2);

        // Wait a bit longer to ensure interval was properly cleared
        await new Promise((r) => setTimeout(r, 50));
        expect(sendTyping.mock.calls.length).toBe(countAtCompletion);
    });

    test("withTypingIndicator should clear interval even if task throws", async () => {
        const sendTyping = mock(async () => {});
        const channel = { isSendable: () => true, sendTyping };

        await expect(
            withTypingIndicator(
                channel,
                async () => {
                    throw new Error("task failed");
                },
                20,
            ),
        ).rejects.toThrow("task failed");

        const countAfterThrow = sendTyping.mock.calls.length;
        await new Promise((r) => setTimeout(r, 50));
        expect(sendTyping.mock.calls.length).toBe(countAfterThrow);
    });

    test("parseSlashCommand should recognize built-in commands only", () => {
        expect(parseSlashCommand("/reset")).toEqual({ command: "reset", args: [] });
        expect(parseSlashCommand("  /STATUS  ")).toEqual({ command: "status", args: [] });
        expect(parseSlashCommand("/help topic")).toEqual({ command: "help", args: ["topic"] });
        expect(parseSlashCommand("/unknown")).toBeNull();
        expect(parseSlashCommand("hello /reset")).toBeNull();
    });
});
