"use strict";

require("dotenv").config();

const {useRestClient} = require("./src/core/discord");
const {Routes} = require("discord-api-types/v9");

const client = useRestClient();

const modules = {
    ...require("./src/triggers/interaction_create/terminal"),
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
                process.env.DISCORD_APP_ID,
                process.env.GUILD_ID,
            ),
            {body: commands},
        );

        console.info("Successfully reloaded application (/) commands.");
    } catch (error) {
        console.error(error);
    }
})();
