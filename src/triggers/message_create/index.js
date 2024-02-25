"use strict";

// eslint-disable-next-line no-unused-vars
const discord = require("discord.js");

const {GoogleGenerativeAI} = require("@google/generative-ai");

const {useClient} = require("../../core/discord");

const prompts = require("../../../prompts.json");

const client = useClient();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({model: "gemini-pro"});
const modelChat = model.startChat({
    history: prompts,
    generationConfig: {
        maxOutputTokens: 500,
    },
});

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

    const meAI = "@<me>";
    const meAIRegex = new RegExp(meAI, "g");

    const meDiscord = `<@${client.user.id}>`;
    const meDiscordRegex = new RegExp(meDiscord, "g");

    const {content: requestContentRaw} = message;
    if (!requestContentRaw.trim()) {
        message.reply("所收到的訊息意圖不明。");
        return;
    }
    const requestContent = requestContentRaw.replaceAll(meDiscordRegex, meAI);
    const result = await modelChat.sendMessage(requestContent);

    const responseContentRaw = result.response.text();
    if (!responseContentRaw.trim()) {
        message.reply("無法正常回覆，請換個說法試試。");
        return;
    }
    const responseContent = responseContentRaw.replaceAll(meAIRegex, meDiscord);
    message.reply(responseContent);
};

