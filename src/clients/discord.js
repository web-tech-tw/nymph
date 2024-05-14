"use strict";
// Discord is a proprietary instant messaging platform.

const {
    getMust,
} = require("../config");

const {
    REST,
} = require("@discordjs/rest");

const {
    Client,
    Partials,
    GatewayIntentBits,
} = require("discord.js");

const botToken = getMust("DISCORD_BOT_TOKEN");

const newClient = async () => {
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
    client.login(botToken);
    return client;
};

/**
 * The cached client.
 * @type {Client|undefined}
 */
let client;
/**
 * Use Discord client
 *
 * @param {boolean} cached - Use the cached client
 * @return {Client} - The client
 */
exports.useClient = async (cached = true) => {
    if (cached && client) {
        return client;
    }
    client = await newClient();
    return client;
};

exports.useRestClient = () => {
    const restClient = new REST({version: "10"});
    restClient.setToken(botToken);
    return restClient;
};

exports.isSenderHasRole = (message, roleId) =>
    message.member.roles.cache.some((role) => role.id === roleId);
