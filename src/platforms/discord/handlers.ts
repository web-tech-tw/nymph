import { Events, ActivityType, PresenceUpdateStatus } from "discord.js";
import type { Interaction, Message, Client } from "discord.js";
import { useDiscordClient } from "./client.ts";
import { registerCommands, resolveCommand } from "./commands.ts";
import { Platform } from "../../types.ts";
import { COMMAND_PREFIX } from "../../constants.ts";
import { hasRelay, relayText, sendText } from "../../bridge/index.ts";
import { chatWithAI, sliceContent, translateText } from "../../agents/chat.ts";
import { Room } from "../../database/models/room.ts";
import type { PlatformAdapter } from "../types.ts";

function say(message: Message, text: string): void {
    const roomId = message.channel.id;
    if (hasRelay(Platform.Discord, roomId)) {
        sendText(Platform.Discord, roomId, text);
    } else {
        message.reply(text);
    }
}

function parseContent(message: Message, client: Client): string {
    let content = message.content
        .replace(/<@!?\d+>/g, (mention) => {
            const uid = mention.replace(/<@!?|>/g, "");
            const user = client.users.cache.get(uid);
            return `@${user?.username ?? "Unknown"}`;
        })
        .trim();

    if (content.startsWith(COMMAND_PREFIX)) {
        content = content.slice(COMMAND_PREFIX.length).trim();
    }
    return content;
}

function onClientReady(): void {
    const client = useDiscordClient();
    console.info(`Discord 身份：${client.user?.tag}`);

    const setPresence = () => {
        client.user?.setPresence({
            status: PresenceUpdateStatus.Online,
            activities: [{ type: ActivityType.Playing, name: "黑客帝國" }],
        });
    };
    setPresence();
    setInterval(setPresence, (86400 - 3600) * 1000);
}

async function onInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    const cmd = resolveCommand(interaction.commandName);
    if (cmd) {
        await cmd.action(interaction);
    } else {
        await interaction.reply("無法存取該指令");
    }
}

async function processChat(message: Message, content: string): Promise<void> {
    if (!content) { say(message, "所收到的訊息意圖不明。"); return; }
    if (message.channel.isSendable()) await message.channel.sendTyping();
    try {
        const response = await chatWithAI(message.channel.id, content);
        if (!response?.trim()) { say(message, "無法正常回覆，請換個說法試試。"); return; }
        sliceContent(response.trim(), 2000).forEach((s) => say(message, s));
    } catch (err) {
        console.error("Chat Error:", err);
        say(message, "思緒混亂，無法回覆。");
    }
}

async function processTranslation(message: Message, content: string): Promise<void> {
    try {
        const room = await Room.findOne({ platform: Platform.Discord, roomId: message.channel.id });
        if (room?.mode !== "translator") return;
        const langs = room.languages?.length === 2 ? room.languages : undefined;
        const translated = await translateText(message.channel.id, content, langs);
        if (translated && translated !== content && message.channel.isSendable()) {
            await message.channel.send(`🌐> ${translated}`);
        }
    } catch (err) {
        console.error("Translation Error:", err);
    }
}

async function onMessageCreate(message: Message): Promise<void> {
    const client = useDiscordClient();
    if (message.author.bot) return;

    const isMentioned = message.mentions.users.has(client.user?.id ?? "");
    const hasPrefix = message.content.startsWith(COMMAND_PREFIX);
    const content = parseContent(message, client);

    relayText(Platform.Discord, message.channel.id, content, message.author.username);

    if (isMentioned || hasPrefix) {
        await processChat(message, content);
    } else {
        await processTranslation(message, content);
    }
}

export const discordAdapter: PlatformAdapter = {
    platform: Platform.Discord,

    async prepare() {
        await registerCommands();
    },

    listen() {
        const client = useDiscordClient();
        client.on(Events.ClientReady, onClientReady);
        client.on(Events.InteractionCreate, onInteractionCreate);
        client.on(Events.MessageCreate, onMessageCreate);
    },
};
