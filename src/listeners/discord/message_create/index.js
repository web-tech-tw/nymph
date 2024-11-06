"use strict";

const discord = require("discord.js");

const {
    PLATFORM_DISCORD,
} = require("../../../init/const");

const {
    relayText,
    useSendText,
} = require("../../../bridges");

const {useClient} = require("../../../clients/discord");
const {chatWithAI, sliceContent} = require("../../../clients/langchain");

/**
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
    const client = useClient();

    if (message.author.bot) {
        return;
    }

    relayText(
        PLATFORM_DISCORD,
        message.channel.id,
        message.content,
        message.author.username,
    );

    if (!message.mentions.users.has(client.user.id)) {
        return;
    }

    await message.channel.sendTyping();
    const sendText = useSendText(
        PLATFORM_DISCORD,
        message.channel.id,
    );

    const requestContent = message.content.trim();
    if (!requestContent) {
        sendText("所收到的訊息意圖不明。");
        return;
    }

    let responseContent;
    try {
        responseContent = await chatWithAI(message.channel.id, requestContent);
    } catch (error) {
        console.error(error);
        sendText("思緒混亂，無法回覆。");
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        sendText("無法正常回覆，請換個說法試試。");
        return;
    }

    const snippets = sliceContent(responseContent, 2000);
    sendText(snippets.shift());
    snippets.forEach((snippet) => {
        sendText(snippet);
    });
};
