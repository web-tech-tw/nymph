"use strict";

const discord = require("discord.js");

const {useClient} = require("../../../clients/discord");
const {usePrompts} = require("../../../clients/gemini");

const prompts = require("../../../../prompts.json");

const client = useClient();
const useChatSession = usePrompts(prompts);

/**
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
    if (message.author.bot) return;

    if (
        !message.mentions.users.has(client.user.id) &&
        message.channel.id !== process.env.CHANNEL_ID_TERMINAL
    ) {
        return;
    }

    await message.channel.sendTyping();

    const {content: requestContent} = message;
    if (!requestContent.trim()) {
        message.reply("所收到的訊息意圖不明。");
        return;
    }

    const chatSession = useChatSession(message.channel.id);
    const result = await chatSession.sendMessage(requestContent);

    const responseContent = result.response.text();
    if (!responseContent.trim()) {
        message.reply("無法正常回覆，請換個說法試試。");
        return;
    }

    message.reply(responseContent);
};

