import { getMust } from "../../../config.ts";
import { useRestClient } from "../../../clients/discord.ts";
import { Routes, CommandInteraction } from "discord.js";
import { PLATFORM_DISCORD } from "../../../init/const.ts";

const restClient = useRestClient();

interface CommandDef {
    description: string;
    options?: any[];
    action: (interaction: CommandInteraction) => Promise<void>;
}

const userId: CommandDef = {
    description: "取得使用者識別碼",
    action: async (interaction) => {
        interaction.reply(
            `使用者代號：\`${interaction.user.tag}\`\n` +
            `使用者編碼：\`${interaction.user.id}\``,
        );
    },
};

const translatorMode: CommandDef = {
    description: "啟用翻譯模式",
    options: [
        {
            name: "lang_a",
            description: "Language A code (e.g., en)",
            type: 3,
            required: true,
        },
        {
            name: "lang_b",
            description: "Language B code (e.g., zh)",
            type: 3,
            required: true,
        },
    ],
    action: async (interaction) => {
        const { default: Room } = await import("../../../models/room.ts");
        const platform = PLATFORM_DISCORD;
        const roomId =
            interaction.channelId ||
            (interaction.channel && interaction.channel.id) ||
            interaction.guildId ||
            "unknown";

        const langA = interaction.options?.getString
            ? interaction.options.getString("lang_a")
            : null;
        const langB = interaction.options?.getString
            ? interaction.options.getString("lang_b")
            : null;

        if (!langA || !langB) {
            interaction.reply("請提供兩個語言代碼，例如：en zh");
            return;
        }
        if (langA === langB) {
            interaction.reply("請提供兩個不同的語言代碼");
            return;
        }

        await Room.findOneAndUpdate(
            { platform, roomId },
            {
                $set: {
                    mode: "translator",
                    languages: [langA, langB],
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        const replyMsg =
            "已啟用 **翻譯模式**（mode: translator），語言：" +
            langA +
            " <-> " +
            langB;
        interaction.reply(replyMsg);
    },
};

const normalMode: CommandDef = {
    description: "切回普通模式",
    action: async (interaction) => {
        const { default: Room } = await import("../../../models/room.ts");
        const platform = PLATFORM_DISCORD;
        const roomId =
            interaction.channelId ||
            (interaction.channel && interaction.channel.id) ||
            interaction.guildId ||
            "unknown";
        await Room.findOneAndUpdate(
            { platform, roomId },
            {
                $set: {
                    mode: "normal",
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        interaction.reply("已切換為 **普通模式**（mode: normal）");
    },
};

export const allCommands: Record<string, CommandDef> = {
    userId,
    translatorMode,
    normalMode,
};

/**
 * Registers commands with the Discord API.
 */
export async function registerCommands() {
    const appId = getMust("DISCORD_APP_ID");
    const guildId = getMust("DISCORD_GUILD_ID");

    const camelToSnakeCase = (str: string) =>
        str.replace(/[A-Z]/g, (group) => `_${group.toLowerCase()}`);

    const commands = Object.entries(allCommands).map(([i, j]) => ({
        name: camelToSnakeCase(i),
        description: j.description,
        options: j.options || null,
    }));

    await restClient.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commands },
    );
}
