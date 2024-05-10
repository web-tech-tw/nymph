"use strict";
// Discord is a proprietary instant messaging platform.

const {
    REST,
} = require("@discordjs/rest");

const {
    Client,
    Partials,
    GatewayIntentBits,
} = require("discord.js");

const newClient = () => {
    const client = new Client({
        partials: [
            Partials.Channel,
            Partials.Message,
            Partials.Reaction,
        ],
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageTyping,
            GatewayIntentBits.MessageContent,
        ],
    });
    client.login(process.env.DISCORD_BOT_TOKEN);
    return client;
};

let client;
/**
 * Use Discord client
 *
 * @param {boolean} cached - Use the cached client
 * @return {Client} - The client
 */
exports.useClient = (cached = true) => {
    if (cached && client) {
        return client;
    }
    client = newClient();
    return client;
};

exports.useRestClient = () => {
    const restClient = new REST({version: "10"});
    restClient.setToken(process.env.DISCORD_BOT_TOKEN);
    return restClient;
};

exports.isSenderHasRole = (message, roleId) =>
    message.member.roles.cache.some((role) => role.id === roleId);
