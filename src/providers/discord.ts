import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    PresenceUpdateStatus,
    ActivityType
} from "discord.js";
import { PlatformName } from "../types/provider";
import type {
    BasePlatformProvider,
    MessageCallback,
    CommandCallback,
    ChatContext
} from "../types/provider";
import type { DiscordProviderParams } from "../types/discord";

import { sliceContent } from "../utils/text";

export class DiscordProvider implements BasePlatformProvider {
    readonly name: PlatformName = PlatformName.Discord;
    readonly enabled: boolean;

    #token: string;
    #presence: string;
    #client: Client | null = null;
    #messageCallbacks: MessageCallback[] = [];
    #commandCallbacks: CommandCallback[] = [];

    constructor(params: DiscordProviderParams) {
        this.#token = params.token;
        this.#presence = params.presence || "萬眾一心";
        this.enabled = this.#token !== "";
    }

    async start(): Promise<void> {
        if (!this.enabled) return;
        if (this.#client) return;

        const client = new Client({
            partials: [Partials.Channel, Partials.Message],
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        client.on(Events.ClientReady, () => {
            console.info(`[DiscordProvider] Logged in as ${client.user?.tag}`);
            client.user?.setPresence({
                status: PresenceUpdateStatus.Online,
                activities: [{ type: ActivityType.Playing, name: this.#presence }],
            });
        });

        client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;

            const isDirectMessage = !message.guild;
            const isMentioned = client.user ? message.mentions.users.has(client.user.id) : false;

            if (!isDirectMessage && !isMentioned) return;

            let cleanContent = message.content;
            if (client.user) {
                const mentionRegex = new RegExp(`<@!?${client.user.id}>`, "g");
                cleanContent = cleanContent.replace(mentionRegex, "").trim();
            }

            if (!cleanContent) return;

            if (message.channel.isSendable()) {
                await message.channel.sendTyping().catch(() => { });
            }

            const ctx: ChatContext = {
                platformName: PlatformName.Discord,
                roomId: message.channel.id,
                sender: {
                    id: message.author.id,
                    nickname: message.member?.displayName ?? message.author.displayName ?? message.author.username,
                    username: message.author.username,
                },
                content: cleanContent,
                reply: async (text: string) => {
                    await this.sendText(message.channel.id, text);
                },
            };

            for (const cb of this.#messageCallbacks) {
                try {
                    await cb(ctx);
                } catch (error) {
                    console.error("[DiscordProvider] Error executing message callback:", error);
                }
            }
        });

        this.#client = client;
        await client.login(this.#token);
    }

    async stop(): Promise<void> {
        if (this.#client) {
            await this.#client.destroy();
            this.#client = null;
        }
    }

    onMessage(cb: MessageCallback): void {
        this.#messageCallbacks.push(cb);
    }

    onCommand(cb: CommandCallback): void {
        this.#commandCallbacks.push(cb);
    }

    async sendText(roomId: string, content: string): Promise<void> {
        if (!this.enabled || !this.#client) return;

        const channel = await this.#client.channels.fetch(roomId).catch(() => null);
        if (!channel || !channel.isSendable()) return;

        const chunks = sliceContent(content, 2000);
        for (const chunk of chunks) {
            await channel.send(chunk);
        }
    }
}