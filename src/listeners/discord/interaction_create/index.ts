
import type { Interaction } from "discord.js";
import {allCommands} from "./commands.ts";

const snakeToCamelCase = (str: string) =>
    str.toLowerCase().replace(/([-_][a-z])/g, (group) =>
        group
            .toUpperCase()
            .replace("-", "")
            .replace("_", ""),
    );

/**
 * Handles Discord interaction create events.
 * @param {discord.Interaction} interaction - The Discord interaction object.
 * @return {void}
 */
export default async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    const actionName = snakeToCamelCase(interaction.commandName);
    if (actionName in allCommands) {
        allCommands[actionName].action(interaction);
    } else {
        await interaction.reply("無法存取該指令");
    }
};
