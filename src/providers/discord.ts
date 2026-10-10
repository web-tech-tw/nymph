import {
    Client,
    EmbedBuilder,
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
import { saveReceivedImage } from "../utils/media";
import { formatReplyBreadcrumb } from "../utils/prompts";
import { extractArxivUrls, parseArxivReplyCard, type ArxivReplyCard } from "../utils/arxiv";

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

            let cleanContent = message.content;
            if (client.user) {
                const mentionRegex = new RegExp(`<@!?${client.user.id}>`, "g");
                cleanContent = cleanContent.replace(mentionRegex, "").trim();
            }

            // arxiv links trigger a paper read even without an explicit mention
            const hasArxivUrl = extractArxivUrls(cleanContent).length > 0;

            if (!isDirectMessage && !isMentioned && !hasArxivUrl) return;

            const imageAttachments = message.attachments.filter(
                (att) => att.contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.name || ""),
            );

            if (!cleanContent && imageAttachments.size === 0) return;

            if (message.channel.isSendable()) {
                await message.channel.sendTyping().catch((err) => {
                    console.warn("[DiscordProvider] Failed to send typing indicator:", err);
                });
            }

            // Resolve the replied-to message (reply chain, one level deep)
            const referenced = message.reference?.messageId
                ? await message.fetchReference().catch(() => null)
                : null;
            let replyTo: ChatContext["replyTo"];
            if (referenced) {
                const refAuthor =
                    referenced.member?.displayName ?? referenced.author.displayName ?? referenced.author.username;
                // breadcrumb stays with the stored content; full text only lives for this turn
                cleanContent = `${formatReplyBreadcrumb(refAuthor, referenced.content)}\n${cleanContent}`;
                if (referenced.author.id !== client.user?.id) {
                    replyTo = { author: refAuthor, content: referenced.content };
                }
            } else if (message.reference?.messageId) {
                cleanContent = `回覆（原始訊息已不存在）\n${cleanContent}`;
            }

            for (const [, attachment] of imageAttachments) {
                try {
                    const res = await fetch(attachment.url);
                    if (res.ok) {
                        const buffer = await res.arrayBuffer();
                        const id = await saveReceivedImage(buffer);
                        const imageCtx: ChatContext = {
                            platformName: PlatformName.Discord,
                            roomId: message.channel.id,
                            sender: {
                                id: message.author.id,
                                nickname: message.member?.displayName ?? message.author.displayName ?? message.author.username,
                                username: message.author.username,
                            },
                            type: "image",
                            content: id,
                            reply: async (text: string) => {
                                await this.sendText(message.channel.id, text);
                            },
                        };

                        for (const cb of this.#messageCallbacks) {
                            try {
                                await cb(imageCtx);
                            } catch (error) {
                                console.error("[DiscordProvider] Error executing image callback:", error);
                            }
                        }
                    }
                } catch (error) {
                    console.error("[DiscordProvider] Error processing image attachment:", error);
                }
            }

            if (cleanContent) {
                const ctx: ChatContext = {
                    platformName: PlatformName.Discord,
                    roomId: message.channel.id,
                    sender: {
                        id: message.author.id,
                        nickname: message.member?.displayName ?? message.author.displayName ?? message.author.username,
                        username: message.author.username,
                    },
                    type: "text",
                    content: cleanContent,
                    replyTo,
                    reply: async (text: string) => {
                        await this.sendReply(message.channel.id, text);
                    },
                };

                for (const cb of this.#messageCallbacks) {
                    try {
                        await cb(ctx);
                    } catch (error) {
                        console.error("[DiscordProvider] Error executing message callback:", error);
                    }
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

    /**
     * Sends an agent reply: arxiv card blocks render as an embed card,
     * everything else falls back to plain text.
     */
    async sendReply(roomId: string, content: string): Promise<void> {
        const card = parseArxivReplyCard(content);
        if (!card) {
            await this.sendText(roomId, content);
            return;
        }
        await this.sendArxivCard(roomId, card);
    }

    private async sendArxivCard(roomId: string, card: ArxivReplyCard): Promise<void> {
        const channel = await this.#client?.channels.fetch(roomId).catch((err) => {
            console.error(`[DiscordProvider] Failed to fetch channel ${roomId}:`, err);
            return null;
        });
        if (!channel?.isSendable()) {
            console.error(`[DiscordProvider] Channel ${roomId} is not sendable, falling back to text`);
            await this.sendText(roomId, card.summary);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xb31b1b)
            .setTitle(card.title.slice(0, 256))
            .setURL(card.url || null)
            .setDescription(card.summary.slice(0, 4096))
            .addFields({ name: "心得", value: card.comment.slice(0, 1024) || "—" })
            .setFooter({ text: "arXiv 論文速覽" })
            .setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(`[DiscordProvider] Failed to send arxiv card to channel ${roomId}:`, err);
        }
    }

    async sendText(roomId: string, content: string): Promise<void> {
        if (!this.enabled) {
            console.warn("[DiscordProvider] Cannot send text: Provider is disabled");
            return;
        }
        if (!this.#client) {
            console.warn("[DiscordProvider] Cannot send text: Discord client is not initialized");
            return;
        }

        const channel = await this.#client.channels.fetch(roomId).catch((err) => {
            console.error(`[DiscordProvider] Failed to fetch channel ${roomId}:`, err);
            return null;
        });
        if (!channel) {
            console.error(`[DiscordProvider] Channel ${roomId} not found`);
            return;
        }
        if (!channel.isSendable()) {
            console.error(`[DiscordProvider] Channel ${roomId} is not sendable`);
            return;
        }

        const chunks = sliceContent(content, 2000);
        for (const chunk of chunks) {
            try {
                await channel.send(chunk);
            } catch (err) {
                console.error(`[DiscordProvider] Failed to send message to channel ${roomId}:`, err);
            }
        }
    }
}