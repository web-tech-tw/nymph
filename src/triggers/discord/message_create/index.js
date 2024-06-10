"use strict";

const discord = require("discord.js");

const discordToMatrix = require("../../../bridges/discord_matrix");

const {useClient} = require("../../../clients/discord");
const {chatWithAI} = require("../../../clients/openai");

/**
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
    const client = await useClient();

    if (message.author.bot) {
        return;
    }

    discordToMatrix(message);

    if (!message.mentions.users.has(client.user.id)) {
        return;
    }

    await message.channel.sendTyping();

    const requestContent = message.content.trim();
    if (!requestContent) {
        message.reply("所收到的訊息意圖不明。");
        return;
    }

    let responseContent;
    try {
        responseContent = await chatWithAI(message.channel.id, requestContent);
    } catch (error) {
        console.error(error);
        message.reply("思緒混亂，無法回覆。");
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        message.reply("無法正常回覆，請換個說法試試。");
        return;
    }

    message.reply(responseContent);
};
