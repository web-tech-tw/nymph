"use strict";

const discord = require("discord.js");

const {
    PLATFORM_DISCORD,
} = require("../../../init/const");

const {
    relayText,
    sendText,
} = require("../../../bridges");

const {
    useClient,
} = require("../../../clients/discord");
const {
    chatWithAI,
    sliceContent,
} = require("../../../clients/langchain");

const prefix = "Nymph ";

const hey = (message) => ({
    say: (text) => {
        const roomId = message.channel.id;
        sendText(PLATFORM_DISCORD, roomId, text);
        message.reply(text);
    },
});

const extractContent = (message) =>
    message.content.replace(/<@!?\d+>/g, (mention) => {
        const userId = mention.replace(/<@!?|>/g, "");
        const user = message.client.users.cache.get(userId);
        return `@${user ? user.username : "Unknown"}`;
    }).trim();

/**
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
    const client = useClient();

    if (message.author.bot) {
        return;
    }

    const requestContent = extractContent(message);
    relayText(
        PLATFORM_DISCORD,
        message.channel.id,
        requestContent,
        message.author.username,
    );

    if (
        !(message.content.startsWith(prefix)) &&
        !(message.mentions.users.has(client.user.id))
    ) {
        return;
    }

    await message.channel.sendTyping();
    if (!requestContent) {
        hey(message).say("所收到的訊息意圖不明。");
        return;
    }

    let responseContent;
    try {
        responseContent = await chatWithAI(message.channel.id, requestContent);
    } catch (error) {
        console.error(error);
        hey(message).say("思緒混亂，無法回覆。");
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        hey(message).say("無法正常回覆，請換個說法試試。");
        return;
    }

    const snippets = sliceContent(responseContent, 2000);
    hey(message).say(snippets.shift());
    snippets.forEach((snippet) => {
        hey(message).say(snippet);
    });
};
