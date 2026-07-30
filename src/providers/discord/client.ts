import { bridgeProviderConfig } from "../../config.ts";
import { REST } from "@discordjs/rest";
import { Client, Partials, GatewayIntentBits } from "discord.js";
import type { Message } from "discord.js";

function getBotToken(): string {
    const config = bridgeProviderConfig();
    return config.discord?.botToken || process.env.DISCORD_BOT_TOKEN || "";
}

function createClient(): Client {
    const token = getBotToken();
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
    if (token) {
        client.login(token).catch((err) => console.error("[DiscordClient]: Login error:", err));
    }
    return client;
}

let _client: Client | undefined;

export function useDiscordClient(refresh = false): Client {
    if (!refresh && _client) return _client;
    _client = createClient();
    return _client;
}

export function useDiscordRest(): REST {
    return new REST({ version: "10" }).setToken(getBotToken());
}

export function isSenderHasRole(message: Message, roleId: string): boolean {
    return message.member?.roles.cache.some((r) => r.id === roleId) ?? false;
}
