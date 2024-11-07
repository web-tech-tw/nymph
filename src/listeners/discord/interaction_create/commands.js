"use strict";

const {getMust} = require("../../../config");
const {useRestClient} = require("../../../clients/discord");

const discord = require("discord.js");
const Routes = discord.Routes;

const restClient = useRestClient();

const userId = {
    description: "取得使用者識別碼",
    action: async (interaction) => {
        interaction.reply(
            `使用者代號：\`${interaction.user.tag}\`\n` +
            `使用者編碼：\`${interaction.user.id}\``,
        );
    },
};

exports.allCommands = {
    userId,
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
