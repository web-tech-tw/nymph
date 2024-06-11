"use strict";

const {useClient, whereSentMessageEvent} = require("../../../clients/line");
const {chatWithAI} = require("../../../clients/openai");

const prefix = "Nymph ";

module.exports = async (event) => {
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
    const {
        quoteToken,
        text: messageText,
    } = message;

    let requestContent = messageText;
    if (sourceType !== "user" && !requestContent.startsWith(prefix)) {
        return;
    }
    if (requestContent.startsWith(prefix)) {
        requestContent = requestContent.slice(prefix.length).trim();
    }

    const sourceId = whereSentMessageEvent(event);
    if (sourceType === "user") {
        await client.showLoadingAnimation({chatId: sourceId});
    }

    if (!requestContent) {
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
        responseContent = await chatWithAI(sourceId, requestContent);
    } catch (error) {
        console.error(error);
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

    await client.replyMessage({
        replyToken,
        messages: [{
            type: "text",
            text: responseContent,
            quoteToken,
        }],
    });
};
