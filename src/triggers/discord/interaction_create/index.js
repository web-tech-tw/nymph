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

    const commands = require("./commands");

    const actionName = snakeToCamelCase(interaction.commandName);
    if (actionName in commands) {
        commands[actionName].action(interaction);
    } else {
        await interaction.reply("無法存取該指令");
    }
};
