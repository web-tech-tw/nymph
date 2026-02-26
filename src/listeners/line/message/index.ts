
import {useClient, whereSentMessageEvent} from "../../../clients/line.ts";
import {chatWithAI, sliceContent} from "../../../clients/langchain.ts";
import type { MessageEvent, TextEventMessage } from "@line/bot-sdk";

const prefix = "Nymph ";

export default async (event: MessageEvent) => {
    if (event.message.type !== "text") {
        return;
    }

    const client = useClient();

    const {
        replyToken,
        source,
        message,
    } = event;
    const {
        type: sourceType,
    } = source;
    // @ts-ignore
    const {
        quoteToken,
        text: messageText,
    } = message as TextEventMessage;

    let requestContent = messageText;
    if (sourceType !== "user" && !requestContent.startsWith(prefix)) {
        return;
    }
    if (requestContent.startsWith(prefix)) {
        requestContent = requestContent.slice(prefix.length).trim();
    }

    const sourceId = whereSentMessageEvent(event);
    if (sourceType === "user" && sourceId) {
        await client.showLoadingAnimation({chatId: sourceId, loadingSeconds: 5}); // Added loadingSeconds as it might be required or good practice, check types if available. actually it takes {chatId, loadingSeconds?}
    }

    if (!requestContent) {
        // @ts-ignore
        await client.replyMessage({
            replyToken,
            messages: [{
                type: "text",
                text: "所收到的訊息意圖不明。",
                quoteToken,
            }],
        });
        return;
    }

    let responseContent;
    try {
        if (!sourceId) throw new Error("Source ID not found");
        responseContent = await chatWithAI(sourceId, requestContent);
    } catch (error) {
        console.error(error);
        // @ts-ignore
        await client.replyMessage({
            replyToken,
            messages: [{
                type: "text",
                text: "思緒混亂，無法回覆。",
                quoteToken,
            }],
        });
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        // @ts-ignore
        await client.replyMessage({
            replyToken,
            messages: [{
                type: "text",
                text: "無法正常回覆，請換個說法試試。",
                quoteToken,
            }],
        });
        return;
    }

    const snippets = sliceContent(responseContent, 5000);
    const replyMessages: any[] = [];
    replyMessages.push({
        type: "text",
        text: snippets.shift(),
        quoteToken,
    });
    replyMessages.push(...snippets.map((snippet) => ({
        type: "text",
        text: snippet,
    })));
    // @ts-ignore
    await client.replyMessage({
        replyToken,
        messages: replyMessages,
    });
};
