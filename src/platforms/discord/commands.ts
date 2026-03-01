import { envRequired } from "../../config/index.ts";
import { useDiscordRest } from "./client.ts";
import { Routes } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { Platform } from "../../types.ts";
import { Room } from "../../database/models/room.ts";

interface CommandDef {
    description: string;
    options?: ReadonlyArray<{
        name: string;
        description: string;
        type: number;
        required: boolean;
    }>;
    action(interaction: ChatInputCommandInteraction): Promise<void>;
}

const userId: CommandDef = {
    description: "取得使用者識別碼",
    action: async (interaction) => {
        await interaction.reply(
            `使用者代號：\`${interaction.user.tag}\`\n` +
            `使用者編碼：\`${interaction.user.id}\``,
        );
    },
};

const translatorMode: CommandDef = {
    description: "啟用翻譯模式",
    options: [
        { name: "lang_a", description: "Language A code (e.g., en)", type: 3, required: true },
        { name: "lang_b", description: "Language B code (e.g., zh)", type: 3, required: true },
    ],
    action: async (interaction) => {
        const roomId = interaction.channelId ?? interaction.guildId ?? "unknown";
        const langA = interaction.options.get("lang_a")?.value as string | undefined;
        const langB = interaction.options.get("lang_b")?.value as string | undefined;

        if (!langA || !langB) {
            await interaction.reply("請提供兩個語言代碼，例如：en zh");
            return;
        }
        if (langA === langB) {
            await interaction.reply("請提供兩個不同的語言代碼");
            return;
        }

        await Room.findOneAndUpdate(
            { platform: Platform.Discord, roomId },
            { $set: { mode: "translator", languages: [langA, langB] } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        await interaction.reply(`已啟用 **翻譯模式**，語言：${langA} ↔ ${langB}`);
    },
};

const normalMode: CommandDef = {
    description: "切回普通模式",
    action: async (interaction) => {
        const roomId = interaction.channelId ?? interaction.guildId ?? "unknown";
        await Room.findOneAndUpdate(
            { platform: Platform.Discord, roomId },
            { $set: { mode: "normal" } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        await interaction.reply("已切換為 **普通模式**");
    },
};

const allCommands: Record<string, CommandDef> = {
    userId,
    translatorMode,
    normalMode,
};

const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const snakeToCamel = (s: string) =>
    s.toLowerCase().replace(/[-_]([a-z])/g, (_, c: string) => c.toUpperCase());

export async function registerCommands(): Promise<void> {
    const rest = useDiscordRest();
    const appId = envRequired("DISCORD_APP_ID");
    const guildId = envRequired("DISCORD_GUILD_ID");

    const body = Object.entries(allCommands).map(([name, def]) => ({
        name: camelToSnake(name),
        description: def.description,
        options: def.options ?? null,
    }));

    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
}

export function resolveCommand(commandName: string): CommandDef | undefined {
    return allCommands[snakeToCamel(commandName)];
}
