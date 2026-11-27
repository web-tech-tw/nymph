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

    test("should render Flex Message for arXiv reply and attach arXiv Quick Reply", async () => {
        let sentPayload: { replyToken: string; messages: Array<Record<string, unknown>> } | null = null;
        const replyMessageMock = mock(async (req: { replyToken: string; messages: Array<Record<string, unknown>> }) => {
            sentPayload = req;
            return {};
        });
        const pushMessageMock = mock(async () => ({}));

        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient({
            replyMessage: replyMessageMock,
            pushMessage: pushMessageMock,
            showLoadingAnimation: mock(async () => ({})),
            getProfile: mock(async () => ({ displayName: "Reader" })),
        } as unknown as Parameters<LineProvider["setClient"]>[0]);

        provider.onMessage(async (ctx) => {
            await ctx.reply(
                "<arxiv_reply><title>Demo Paper</title><url>https://arxiv.org/abs/2501.00001</url><summary>A concise summary.</summary><comment>Solid work.</comment></arxiv_reply>",
            );
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-arxiv-1",
                    replyToken: "reply-token-arxiv",
                    source: { type: "user", userId: "U777" },
                    message: { type: "text", id: "m3", text: "https://arxiv.org/abs/2501.00001" },
                },
            ],
        });

        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(replyMessageMock).toHaveBeenCalledTimes(1);
        expect(pushMessageMock).toHaveBeenCalledTimes(0);
        expect(sentPayload).not.toBeNull();
        expect(sentPayload!.messages[0]?.type).toBe("flex");
        const qr = sentPayload!.messages[0]?.quickReply as { items?: Array<{ action?: { label?: string } }> };
        expect(qr?.items?.some((i) => i.action?.label?.includes("方法與架構"))).toBe(true);
    });

    test("should attach continue Quick Reply when replyMetadata.converged is true", async () => {
        let sentPayload: { replyToken: string; messages: Array<Record<string, unknown>> } | null = null;
        const replyMessageMock = mock(async (req: { replyToken: string; messages: Array<Record<string, unknown>> }) => {
            sentPayload = req;
            return {};
        });

        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient({
            replyMessage: replyMessageMock,
            showLoadingAnimation: mock(async () => ({})),
            getProfile: mock(async () => ({ displayName: "User" })),
        } as unknown as Parameters<LineProvider["setClient"]>[0]);

        provider.onMessage(async (ctx) => {
            await ctx.reply("先依目前查到的資訊整理如下。", { converged: true });
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-conv-1",
                    replyToken: "reply-token-conv",
                    source: { type: "user", userId: "U888" },
                    message: { type: "text", id: "m4", text: "深查問題" },
                },
            ],
        });

        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        const qr = sentPayload!.messages[0]?.quickReply as { items?: Array<{ action?: { label?: string } }> };
        expect(qr?.items?.[0]?.action?.label).toContain("繼續深入查證");
    });
});
