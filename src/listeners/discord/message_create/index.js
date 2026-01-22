"use strict";

const discord = require("discord.js");

const {PLATFORM_DISCORD} = require("../../../init/const");

const {hasRelay, relayText, sendText} = require("../../../bridges");

const {useClient} = require("../../../clients/discord");
const {chatWithAI, sliceContent, translateText} =
    require("../../../clients/langchain");

const prefix = "Nymph ";

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

const extractContent = (message, client) => {
    // Replace mentions with @username
    let content = message.content.replace(/<@!?\d+>/g, (mention) => {
        const userId = mention.replace(/<@!?|>/g, "");
        const user = client.users.cache.get(userId);
        return `@${user ? user.username : "Unknown"}`;
    }).trim();

    // Remove prefix if present to simplify command parsing
    if (content.startsWith(prefix)) {
        content = content.slice(prefix.length).trim();
    }

    return content;
};

/**
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
    const client = useClient();

    if (message.author.bot) {
        return;
    }

    const isMentioned = message.mentions.users.has(client.user.id);
    const hasPrefix = message.content.startsWith(prefix);
    const isDirectCall = isMentioned || hasPrefix;

    // Extract content without mention / prefix
    const requestContent = extractContent(message, client);

    // Always relay the incoming content (extracted)
    relayText(
        PLATFORM_DISCORD,
        message.channel.id,
        requestContent,
        message.author.username,
    );

    const Room = require("../../../models/room");

    // Command Layer: only when explicitly called (prefix or mention)
    if (isDirectCall) {
        if (!requestContent) {
            hey(message).say("所收到的訊息意圖不明。");
            return;
        }

        // Handle mode commands (e.g., "普通模式", "翻譯模式 A B")
        const content = requestContent;

        // 切換回普通模式
        if (content === "普通模式") {
            try {
                await Room.findOneAndUpdate(
                    {platform: PLATFORM_DISCORD, roomId: message.channel.id},
                    {mode: "normal", languages: []},
                    {upsert: true, new: true},
                );
                hey(message).say("已切換回普通模式 (Normal Mode)。");
                return;
            } catch (err) {
                console.error("Failed to set normal mode:", err);
                hey(message).say("無法切換模式，請稍後再試。");
                return;
            }
        }

        // 翻譯模式，格式：翻譯模式 LangA LangB
        if (content.startsWith("翻譯模式")) {
            const args = content.split(/\s+/);
            if (args.length < 3) {
                hey(message).say("指令錯誤。請指定兩種語言，例如：");
                hey(message).say("`Nymph 翻譯模式 繁體中文 English`");
                return;
            }
            const langA = args[1];
            const langB = args[2];
            try {
                await Room.findOneAndUpdate(
                    {platform: PLATFORM_DISCORD, roomId: message.channel.id},
                    {mode: "translator", languages: [langA, langB]},
                    {upsert: true, new: true},
                );
                hey(message).say(`已啟動雙向翻譯模式：${langA} <-> ${langB}`);
                return;
            } catch (err) {
                console.error("Failed to set translator mode:", err);
                hey(message).say("無法啟動翻譯模式，請稍後再試。");
                return;
            }
        }

        // If it's a direct call and not a mode command, treat as chat
        await message.channel.sendTyping();
        try {
            const responseContent = await chatWithAI(
                message.channel.id,
                requestContent,
            );
            if (!responseContent || !responseContent.trim()) {
                hey(message).say("無法正常回覆，請換個說法試試。");
                return;
            }
            const snippets = sliceContent(responseContent.trim(), 2000);
            hey(message).say(snippets.shift());
            snippets.forEach((snippet) => {
                hey(message).say(snippet);
            });
        } catch (err) {
            console.error(err);
            hey(message).say("思緒混亂，無法回覆。");
        }

        return;
    }

    // State Layer / Business Logic for non-direct messages
    // Only needs to check if channel is in translator mode
    try {
        const roomRecord = await Room.findOne({
            platform: PLATFORM_DISCORD,
            roomId: message.channel.id,
        });

        const currentMode = roomRecord ? roomRecord.mode : "normal";
        console.log("Current mode:", currentMode);

        // Translator Mode: translate every message unless it's a direct call
        if (currentMode === "translator") {
            try {
                let langs = null;
                if (roomRecord.languages && roomRecord.languages.length === 2) {
                    langs = roomRecord.languages;
                }
                const translated = await translateText(
                    message.channel.id,
                    requestContent,
                    langs,
                );
                if (translated && translated !== requestContent) {
                    // Post translation as a normal message
                    message.channel.send(`[譯] ${translated}`);
                }
            } catch (err) {
                console.error("Translation failed:", err);
            }
            return;
        }
    } catch (err) {
        console.error("Channel lookup failed:", err);
    }

    // Normal mode and not directly called: do nothing
    return;
};
