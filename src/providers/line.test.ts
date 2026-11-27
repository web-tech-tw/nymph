import { describe, test, expect, mock } from "bun:test";
import { LineProvider, stripLineGroupMention } from "./line";
import type { ChatContext } from "../types/provider";

describe("LineProvider", () => {
    test("stripLineGroupMention should match @Nymph, 寧芙, and slash commands", () => {
        expect(stripLineGroupMention("@Nymph 請問 HTTP/3 是什麼")).toEqual({
            matched: true,
            content: "請問 HTTP/3 是什麼",
        });
        expect(stripLineGroupMention("寧芙，幫我看一下")).toEqual({
            matched: true,
            content: "幫我看一下",
        });
        expect(stripLineGroupMention("/reset")).toEqual({
            matched: true,
            content: "/reset",
        });
        expect(stripLineGroupMention("大家今天吃什麼")).toEqual({
            matched: false,
            content: "大家今天吃什麼",
        });
    });

    test("should strictly use replyMessage with replyToken and never call pushMessage", async () => {
        const replyMessageMock = mock(async () => ({}));
        const pushMessageMock = mock(async () => ({}));
        const showLoadingMock = mock(async () => ({}));
        const getProfileMock = mock(async () => ({ displayName: "Shiranui" }));

        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient({
            replyMessage: replyMessageMock,
            pushMessage: pushMessageMock,
            showLoadingAnimation: showLoadingMock,
            getProfile: getProfileMock,
        } as unknown as Parameters<LineProvider["setClient"]>[0]);

        let capturedCtx: ChatContext | null = null;
        provider.onMessage(async (ctx) => {
            capturedCtx = ctx;
            await ctx.reply("| Col A | Col B |\n| --- | --- |\n| 1 | 2 |");
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-001",
                    replyToken: "reply-token-abc",
                    source: { type: "user", userId: "U123" },
                    message: { type: "text", id: "m1", text: "你好" },
                },
            ],
        });

        const result = await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(result.success).toBe(true);
        expect(capturedCtx).not.toBeNull();
        expect(capturedCtx!.sender.nickname).toBe("Shiranui");
        expect(capturedCtx!.softDeadlineMs).toBeGreaterThan(0);
        expect(capturedCtx!.hardDeadlineMs).toBeGreaterThan(capturedCtx!.softDeadlineMs!);

        expect(replyMessageMock).toHaveBeenCalledTimes(1);
        expect(pushMessageMock).toHaveBeenCalledTimes(0);
        expect(showLoadingMock).toHaveBeenCalledTimes(1);

        // Duplicate webhookEventId should be ignored
        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(replyMessageMock).toHaveBeenCalledTimes(1);
    });

    test("should dispatch slash commands via onCommand", async () => {
        const replyMessageMock = mock(async () => ({}));
        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient({
            replyMessage: replyMessageMock,
            getProfile: mock(async () => ({ displayName: "Tester" })),
        } as unknown as Parameters<LineProvider["setClient"]>[0]);

        let receivedCmd = "";
        provider.onCommand(async (cmd, _args, ctx) => {
            receivedCmd = cmd;
            await ctx.reply("reset ok");
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-cmd-1",
                    replyToken: "reply-token-cmd",
                    source: { type: "user", userId: "U999" },
                    message: { type: "text", id: "m2", text: "/reset" },
                },
            ],
        });

        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(receivedCmd).toBe("reset");
        expect(replyMessageMock).toHaveBeenCalledTimes(1);
    });
});
