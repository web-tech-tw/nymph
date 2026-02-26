
import {
    PLATFORM_DISCORD,
} from "../../../init/const.ts";

import {
    hasRelay,
    relayText,
    sendText,
} from "../../../bridges/index.ts";
import {
    useClient,
} from "../../../clients/discord.ts";

import {
    chatWithAI,
    sliceContent,
    translateText,
} from "../../../clients/langchain.ts";

import Room from "../../../models/room.ts";
import type { Message, Client, TextChannel } from "discord.js";

const prefix = "Nymph ";

/**
 * Returns an object with a `say` method to send replies.
 * @param {Object} message - The Discord message object.
 * @return {Object} An object with a `say` method.
 */
const hey = (message: Message) => ({
    say: (text: string) => {
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
const parseContent = (message: Message, client: Client): string => {
    // Replace mentions with usernames
    // @ts-ignore
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
const processChat = async (message: Message, content: string) => {
    if (!content) {
        // @ts-ignore
        return hey(message).say("所收到的訊息意圖不明。");
    }

    // @ts-ignore
    await message.channel.sendTyping();

    try {
        const response = await chatWithAI(message.channel.id, content);

        if (!response?.trim()) {
            // @ts-ignore
            return hey(message).say("無法正常回覆，請換個說法試試。");
        }

        const snippets = sliceContent(response.trim(), 2000);
        // @ts-ignore
        snippets.forEach((snippet) => hey(message).say(snippet));
    } catch (err) {
        console.error("Chat Error:", err);
        // @ts-ignore
        hey(message).say("思緒混亂，無法回覆。");
    }
};

/**
 * Process translation logic
 * @param {Object} message - The Discord message object.
 * @param {string} content - The message content.
 * @return {Promise<void>}
 */
const processTranslation = async (message: Message, content: string) => {
    try {
        // @ts-ignore
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
            content, langs || undefined,
        );

        if (translated && translated !== content) {
            // @ts-ignore
            message.channel.send(`[譯] ${translated}`);
        }
    } catch (err) {
        console.error("Translation Error:", err);
    }
};

// Event handler for message creation
export default async (message: Message) => {
    // @ts-ignore
    const client = useClient() as Client; // Assuming useClient returns the client instance, cast to Client

    if (message.author.bot) return;

    // Detect if the bot is mentioned or if the message starts with the prefix
    const isMentioned = message.mentions.users.has(client?.user?.id || "");
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
