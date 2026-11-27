import { describe, test, expect, mock } from "bun:test";
import { withTypingIndicator, parseSlashCommand } from "./discord";

describe("DiscordProvider helpers", () => {
    test("withTypingIndicator refreshes periodically and clears timer after completion", async () => {
        const sendTyping = mock(async () => {});
        const channel = { isSendable: () => true, sendTyping };

        const result = await withTypingIndicator(
            channel,
            async () => {
                await new Promise((r) => setTimeout(r, 65));
                return "ok";
            },
            25,
        );

        expect(result).toBe("ok");
        const countAtEnd = sendTyping.mock.calls.length;
        expect(countAtEnd).toBeGreaterThanOrEqual(2);

        await new Promise((r) => setTimeout(r, 50));
        expect(sendTyping.mock.calls.length).toBe(countAtEnd);
    });

    test("withTypingIndicator clears timer when task rejects", async () => {
        const sendTyping = mock(async () => {});
        const channel = { isSendable: () => true, sendTyping };

        await expect(
            withTypingIndicator(
                channel,
                async () => {
                    throw new Error("boom");
                },
                20,
            ),
        ).rejects.toThrow("boom");

        const countAfterError = sendTyping.mock.calls.length;
        await new Promise((r) => setTimeout(r, 50));
        expect(sendTyping.mock.calls.length).toBe(countAfterError);
    });

    test("parseSlashCommand parses supported slash commands and ignores regular messages", () => {
        expect(parseSlashCommand("/help")).toEqual({ command: "help", args: [] });
        expect(parseSlashCommand("  /HELP topic  ")).toEqual({ command: "help", args: ["topic"] });
        expect(parseSlashCommand("/unknown")).toBeNull();
        expect(parseSlashCommand("plain text")).toBeNull();
    });
});
