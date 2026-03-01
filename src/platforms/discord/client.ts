import { envRequired } from "../../config/index.ts";
import { REST } from "@discordjs/rest";
import { Client, Partials, GatewayIntentBits } from "discord.js";
import type { Message } from "discord.js";

const botToken = envRequired("DISCORD_BOT_TOKEN");

function createClient(): Client {
    const client = new Client({
        partials: [Partials.Channel, Partials.Message, Partials.Reaction],
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
}

let _client: Client | undefined;

export function useDiscordClient(refresh = false): Client {
    if (!refresh && _client) return _client;
    _client = createClient();
    return _client;
}

export function useDiscordRest(): REST {
    return new REST({ version: "10" }).setToken(botToken);
}

export function isSenderHasRole(message: Message, roleId: string): boolean {
    return message.member?.roles.cache.some((r) => r.id === roleId) ?? false;
}
