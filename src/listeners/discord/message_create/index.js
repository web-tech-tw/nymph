"use strict";

const {
    PLATFORM_DISCORD,
} = require("../../../init/const");

const {
    hasRelay,
    relayText,
    sendText,
} = require("../../../bridges");
const {
    useClient,
} = require("../../../clients/discord");

const {
    chatWithAI,
    sliceContent,
    translateText,
} = require("../../../clients/langchain");

const Room = require("../../../models/room");

const prefix = "Nymph ";

/**
 * Returns an object with a `say` method to send replies.
 * @param {Object} message - The Discord message object.
 * @return {Object} An object with a `say` method.
 */
const hey = (message) => ({
    say: (text) => {
        const roomId = message.channel.id;
        if (hasRelay(PLATFORM_DISCORD, roomId)) {
            sendText(PLATFORM_DISCORD, roomId, text);
        } else {
            message.reply(text);
        }
    },
});

/**
 * Parse message content by replacing mentions and removing prefix.
 * @param {Object} message - The Discord message object.
 * @param {Object} client - The Discord client object.
 * @return {string} The parsed content.
 */
const parseContent = (message, client) => {
    // Replace mentions with usernames
    let content = message.content.replace(/<@!?\d+>/g, (mention) => {
        const userId = mention.replace(/<@!?|>/g, "");
        const user = client.users.cache.get(userId);
        return `@${user ? user.username : "Unknown"}`;
    }).trim();

    // Remove prefix if present
    if (content.startsWith(prefix)) {
        content = content.slice(prefix.length).trim();
    }

    return content;
};

/**
 * Process chat logic
 * @param {Object} message - The Discord message object.
 * @param {string} content - The message content.
 * @return {Promise<void>}
 */
const processChat = async (message, content) => {
    if (!content) {
        return hey(message).say("所收到的訊息意圖不明。");
    }

    await message.channel.sendTyping();

    try {
        const response = await chatWithAI(message.channel.id, content);

        if (!response?.trim()) {
            return hey(message).say("無法正常回覆，請換個說法試試。");
        }

        const snippets = sliceContent(response.trim(), 2000);
        snippets.forEach((snippet) => hey(message).say(snippet));
    } catch (err) {
        console.error("Chat Error:", err);
        hey(message).say("思緒混亂，無法回覆。");
    }
};

/**
 * Process translation logic
 * @param {Object} message - The Discord message object.
 * @param {string} content - The message content.
 * @return {Promise<void>}
 */
const processTranslation = async (message, content) => {
    try {
        const roomRecord = await Room.findOne({
            platform: PLATFORM_DISCORD,
            roomId: message.channel.id,
        });

        if (roomRecord?.mode !== "translator") return;

        // 檢查是否設定特定雙語
        const langs = (
            roomRecord.languages?.length === 2
        ) ? roomRecord.languages : null;

        const translated = await translateText(
            message.channel.id,
            content, langs,
        );

        if (translated && translated !== content) {
            message.channel.send(`[譯] ${translated}`);
        }
    } catch (err) {
        console.error("Translation Error:", err);
    }
};

// Event handler for message creation
module.exports = async (message) => {
    const client = useClient();

    if (message.author.bot) return;

    // Detect if the bot is mentioned or if the message starts with the prefix
    const isMentioned = message.mentions.users.has(client.user.id);
    const hasPrefix = message.content.startsWith(prefix);
    const isDirectCall = isMentioned || hasPrefix;

    // Parse message content
    const content = parseContent(message, client);

    // Really relay the message
    relayText(
        PLATFORM_DISCORD,
        message.channel.id,
        content,
        message.author.username,
    );

    // Process chat or translation based on the call type
    if (isDirectCall) {
        await processChat(message, content);
    } else {
        await processTranslation(message, content);
    }
};
