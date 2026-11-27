import { describe, test, expect, mock } from "bun:test";
import { LineProvider, stripLineGroupMention } from "./line";
import type { ChatContext } from "../types/provider";

function createMockClient() {
    const sentPayloads: Array<{ replyToken: string; messages: Array<Record<string, unknown>> }> = [];
    const replyMessage = mock(async (req: { replyToken: string; messages: Array<Record<string, unknown>> }) => {
        sentPayloads.push(req);
        return {};
    });
    const pushMessage = mock(async () => ({}));
    const showLoadingAnimation = mock(async () => ({}));
    const getProfile = mock(async () => ({ displayName: "TestUser" }));

    return {
        sentPayloads,
        replyMessage,
        pushMessage,
        showLoadingAnimation,
        client: {
            replyMessage,
            pushMessage,
            showLoadingAnimation,
            getProfile,
        } as unknown as Parameters<LineProvider["setClient"]>[0],
    };
}

describe("LineProvider", () => {
    test("stripLineGroupMention matches mention prefixes and supported commands only", () => {
        expect(stripLineGroupMention("@Nymph hello")).toEqual({ matched: true, content: "hello" });
        expect(stripLineGroupMention("寧芙，你好")).toEqual({ matched: true, content: "你好" });
        expect(stripLineGroupMention("/help")).toEqual({ matched: true, content: "/help" });
        expect(stripLineGroupMention("/etc/nginx/nginx.conf")).toEqual({
            matched: false,
            content: "/etc/nginx/nginx.conf",
        });
        expect(stripLineGroupMention("unrelated chat")).toEqual({ matched: false, content: "unrelated chat" });
    });

    test("uses replyMessage exclusively, deduplicates webhookEventId, and sets deadlines", async () => {
        const mockApi = createMockClient();
        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient(mockApi.client);

        let capturedCtx: ChatContext | null = null;
        provider.onMessage(async (ctx) => {
            capturedCtx = ctx;
            await ctx.reply("response", { quickReplies: ["Follow up 1", "Follow up 2"] });
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-1",
                    replyToken: "tok-1",
                    source: { type: "user", userId: "U1" },
                    message: { type: "text", id: "m1", text: "hi" },
                },
            ],
        });

        const res = await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(res.success).toBe(true);
        expect(capturedCtx?.sender.nickname).toBe("TestUser");
        expect(capturedCtx?.softDeadlineMs).toBeGreaterThan(0);
        expect(capturedCtx?.hardDeadlineMs).toBeGreaterThan(capturedCtx!.softDeadlineMs!);

        expect(mockApi.replyMessage).toHaveBeenCalledTimes(1);
        expect(mockApi.pushMessage).toHaveBeenCalledTimes(0);
        expect(mockApi.sentPayloads[0]?.replyToken).toBe("tok-1");
        expect(mockApi.sentPayloads[0]?.messages[0]?.quickReply).toBeDefined();

        // Duplicate delivery must be ignored
        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(mockApi.replyMessage).toHaveBeenCalledTimes(1);
    });

    test("renders arXiv reply as Flex Message with Quick Reply", async () => {
        const mockApi = createMockClient();
        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient(mockApi.client);

        provider.onMessage(async (ctx) => {
            await ctx.reply(
                "<arxiv_reply><title>Paper</title><url>https://arxiv.org/abs/2501.00001</url><summary>Summary.</summary><comment>Note.</comment></arxiv_reply>",
            );
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-arxiv",
                    replyToken: "tok-arxiv",
                    source: { type: "user", userId: "U2" },
                    message: { type: "text", id: "m2", text: "https://arxiv.org/abs/2501.00001" },
                },
            ],
        });

        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(mockApi.pushMessage).toHaveBeenCalledTimes(0);
        expect(mockApi.sentPayloads[0]?.messages[0]?.type).toBe("flex");
        expect(mockApi.sentPayloads[0]?.messages[0]?.quickReply).toBeDefined();
    });

    test("dispatches supported commands via onCommand", async () => {
        const mockApi = createMockClient();
        const provider = new LineProvider({ token: "test-token", secret: "" });
        provider.setClient(mockApi.client);

        let receivedCmd = "";
        provider.onCommand(async (cmd, _args, ctx) => {
            receivedCmd = cmd;
            await ctx.reply("ok", { helpCard: {} });
        });

        const payload = JSON.stringify({
            events: [
                {
                    type: "message",
                    webhookEventId: "evt-help",
                    replyToken: "tok-help",
                    source: { type: "user", userId: "U3" },
                    message: { type: "text", id: "m3", text: "/help" },
                },
            ],
        });

        await provider.handleWebhookPayload(payload, null, { awaitCompletion: true });
        expect(receivedCmd).toBe("help");
        expect(mockApi.sentPayloads[0]?.messages[0]?.type).toBe("flex");
    });
});
