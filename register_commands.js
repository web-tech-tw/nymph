"use strict";

const {
    getMust,
} = require("./src/config");

const {useRestClient} = require("./src/clients/discord");
const {Routes} = require("discord-api-types/v9");

const client = useRestClient();

const modules = {
    ...require("./src/triggers/discord/interaction_create/terminal"),
};

const camelToSnakeCase = (str) =>
    str.replace(/[A-Z]/g, (letter) =>
        `_${letter.toLowerCase()}`,
    );

const commands = Object.keys(modules).map((i) => ({
    name: camelToSnakeCase(i),
    description: modules[i].description,
    options: modules[i].options || null,
}));

console.info(commands);

(async () => {
    try {
        console.info("Started refreshing application (/) commands.");

        await client.put(
            Routes.applicationGuildCommands(
                getMust("DISCORD_APP_ID"),
                getMust("DISCORD_GUILD_ID"),
            ),
            {body: commands},
        );

        console.info("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
})();
