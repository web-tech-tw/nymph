import { useLineClient, extractSourceId } from "./client.ts";
import { chatWithAI, sliceContent } from "../../agents/chat.ts";
import { COMMAND_PREFIX } from "../../constants.ts";
import { Platform } from "../../types.ts";
import type { PlatformAdapter } from "../types.ts";
import type { MessageEvent, TextEventMessage } from "@line/bot-sdk";

async function onMessage(event: MessageEvent): Promise<void> {
    if (event.message.type !== "text") return;

    const client = useLineClient();
    const { replyToken, source, message } = event;
    const { type: sourceType } = source;
    const { quoteToken, text: messageText } = message as TextEventMessage;

    let content = messageText;
    if (sourceType !== "user" && !content.startsWith(COMMAND_PREFIX)) return;
    if (content.startsWith(COMMAND_PREFIX)) {
        content = content.slice(COMMAND_PREFIX.length).trim();
    }

    const sourceId = extractSourceId(event);

    if (sourceType === "user" && sourceId) {
        await client.showLoadingAnimation({ chatId: sourceId, loadingSeconds: 5 });
    }

    if (!content) {
        await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: "所收到的訊息意圖不明。", quoteToken }],
        });
        return;
    }

    let responseContent: string;
    try {
        if (!sourceId) throw new Error("Source ID not found");
        responseContent = await chatWithAI(sourceId, content);
    } catch (error) {
        console.error(error);
        await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: "思緒混亂，無法回覆。", quoteToken }],
        });
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: "無法正常回覆，請換個說法試試。", quoteToken }],
        });
        return;
    }

    const snippets = sliceContent(responseContent, 5000);
    const messages: Array<{ type: "text"; text: string; quoteToken?: string }> = [];
    messages.push({ type: "text", text: snippets.shift()!, quoteToken });
    for (const snippet of snippets) {
        messages.push({ type: "text", text: snippet });
    }
    await client.replyMessage({ replyToken, messages });
}

const triggers: Record<string, (event: MessageEvent) => Promise<void>> = {
    message: onMessage,
};

export function createDispatcher() {
    return async (event: { type: string }) => {
        const handler = triggers[event.type];
        if (handler) await handler(event as MessageEvent);
    };
}

export const lineAdapter: PlatformAdapter = {
    platform: Platform.LINE,

    async prepare() {
        const client = useLineClient();
        const { displayName, basicId } = await client.getBotInfo();
        console.info(`LINE 身份：${displayName} (${basicId})`);
    },

    listen() {
        // LINE uses webhook (HTTP route), no persistent event listener needed.
    },
};
