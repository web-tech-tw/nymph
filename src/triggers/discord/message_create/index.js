"use strict";

const discord = require("discord.js");

const {
    useClient,
} = require("../../../clients/discord");
const {
    usePrompts,
} = require("../../../clients/gemini");

const discordToMatrix = require("../../../bridges/discord_matrix");

const prompts = require("../../../../prompts.json");
const useChatSession = usePrompts(prompts);

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

    const chatSession = useChatSession(message.channel.id);
    let result;
    try {
        result = await chatSession.sendMessage(requestContent);
    } catch (error) {
        console.error(error);
        message.reply("思緒混亂，無法回覆。");
        return;
    }

    const responseContent = result.response.text().trim();
    if (!responseContent) {
        message.reply("無法正常回覆，請換個說法試試。");
        return;
    }

    message.reply(responseContent);
};
