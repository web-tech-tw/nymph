// Discord is a proprietary instant messaging platform.

import { getMust } from "../config.ts";
import { REST } from "@discordjs/rest";
import {
    Client,
    Partials,
    GatewayIntentBits,
} from "discord.js";

const botToken = getMust("DISCORD_BOT_TOKEN");

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
    client.login(botToken);
    return client;
};

let client: any;
export const useClient = (cached = true) => {
    if (cached && client) {
        return client;
    }
    client = newClient();
    return client;
};

export const useRestClient = () => {
    const restClient = new REST({ version: "10" });
    restClient.setToken(botToken);
    return restClient;
};

export const isSenderHasRole = (message: any, roleId: string) =>
    message.member.roles.cache.some((role: any) => role.id === roleId);
