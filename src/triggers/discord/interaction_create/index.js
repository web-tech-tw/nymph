"use strict";

const discord = require("discord.js");

const snakeToCamelCase = (str) =>
    str.toLowerCase().replace(/([-_][a-z])/g, (group) =>
        group
            .toUpperCase()
            .replace("-", "")
            .replace("_", ""),
    );

/**
 * @param {discord.Interaction} interaction
 * @return {void}
 */
module.exports = async (interaction) => {
    if (!interaction.isCommand()) return;

    let commands = {};
    if (interaction.channel.id === process.env.CHANNEL_ID_TERMINAL) {
        commands = {...commands, ...require("./terminal")};
    }

    const actionName = snakeToCamelCase(interaction.commandName);
    if (actionName in commands) {
        commands[actionName].action(interaction);
    } else {
        await interaction.reply("無法存取該指令");
    }
};
