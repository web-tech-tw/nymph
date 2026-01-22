"use strict";

const {getMust} = require("../../../config");
const {useRestClient} = require("../../../clients/discord");

const discord = require("discord.js");
const Routes = discord.Routes;

const restClient = useRestClient();
const {PLATFORM_DISCORD} = require("../../../init/const");

const userId = {
    description: "取得使用者識別碼",
    action: async (interaction) => {
        interaction.reply(
            `使用者代號：\`${interaction.user.tag}\`\n` +
            `使用者編碼：\`${interaction.user.id}\``,
        );
    },
};

const translatorMode = {
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
        const Room = require("../../../models/room");
        const platform = PLATFORM_DISCORD;
        const roomId =
            interaction.channelId ||
            (interaction.channel && interaction.channel.id) ||
            interaction.guildId ||
            "unknown";

        const langA = interaction.options && interaction.options.getString ?
            interaction.options.getString("lang_a") :
            null;
        const langB = interaction.options && interaction.options.getString ?
            interaction.options.getString("lang_b") :
            null;

        if (!langA || !langB) {
            interaction.reply("請提供兩個語言代碼，例如：en zh");
            return;
        }
        if (langA === langB) {
            interaction.reply("請提供兩個不同的語言代碼");
            return;
        }

        await Room.findOneAndUpdate(
            {platform, roomId},
            {
                $set: {
                    mode: "translator",
                    languages: [langA, langB],
                },
            },
            {upsert: true, new: true, setDefaultsOnInsert: true},
        );
        const replyMsg =
            "已啟用 **翻譯模式**（mode: translator），語言：" +
            langA +
            " <-> " +
            langB;
        interaction.reply(replyMsg);
    },
};

const normalMode = {
    description: "切回普通模式",
    action: async (interaction) => {
        const Room = require("../../../models/room");
        const platform = PLATFORM_DISCORD;
        const roomId =
            interaction.channelId ||
            (interaction.channel && interaction.channel.id) ||
            interaction.guildId ||
            "unknown";
        await Room.findOneAndUpdate(
            {platform, roomId},
            {
                $set: {
                    mode: "normal",
                },
            },
            {upsert: true, new: true, setDefaultsOnInsert: true},
        );
        interaction.reply("已切換為 **普通模式**（mode: normal）");
    },
};

exports.allCommands = {
    userId,
    translatorMode,
    normalMode,
};

/**
 * Registers commands with the Discord API.
 */
async function registerCommands() {
    const appId = getMust("DISCORD_APP_ID");
    const guildId = getMust("DISCORD_GUILD_ID");

    const camelToSnakeCase = (str) =>
        str.replace(/[A-Z]/g, (group) =>
            `_${group.toLowerCase()}`,
        );

    const allCommands = exports.allCommands;
    const commands = Object.entries(allCommands).map(([i, j]) => ({
        name: camelToSnakeCase(i),
        description: j.description,
        options: j.options || null,
    }));

    await restClient.put(
        Routes.applicationGuildCommands(appId, guildId),
        {body: commands},
    );
}
exports.registerCommands = registerCommands;
