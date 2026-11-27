import { messagingApi, validateSignature, type webhook } from "@line/bot-sdk";
import { PlatformName } from "../types/provider";
import type {
    BasePlatformProvider,
    MessageCallback,
    CommandCallback,
    ChatContext,
    ReplyMetadata,
} from "../types/provider";
import type { LineProviderParams, WebhookResult } from "../types/line";
import { server as defaultServer, type HttpServer } from "../routes";
import { sliceContent } from "../utils/text";
import { extractSourceId } from "../utils/line";
import { saveReceivedImage } from "../utils/media";
import { parseArxivReplyCard, flattenArxivReply } from "../utils/arxiv";
import { convertMarkdownTablesToDiscordLists } from "../utils/markdown-table-ast";
import {
    buildArxivFlexMessage,
    buildHelpFlexMessage,
    buildLineQuickReply,
    buildStatusFlexMessage,
} from "../utils/line-flex";
import { parseSlashCommand } from "./discord";

const MAX_SEEN_EVENT_IDS = 1000;
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
const LINE_MAX_REPLY_MESSAGES = 5;
const DEFAULT_LINE_SOFT_DEADLINE_MS = 35_000;
const DEFAULT_LINE_HARD_DEADLINE_MS = 52_000;

const LINE_MENTION_PREFIX_REGEX = /^(?:@?(?:nymph|寧芙)[,，:：\s]*)/i;

interface CachedProfile {
    displayName: string;
    expiresAt: number;
}

export function stripLineGroupMention(text: string): { matched: boolean; content: string } {
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) {
        return { matched: true, content: trimmed };
    }
    if (LINE_MENTION_PREFIX_REGEX.test(trimmed)) {
        return {
            matched: true,
            content: trimmed.replace(LINE_MENTION_PREFIX_REGEX, "").trim(),
        };
    }
    return { matched: false, content: trimmed };
}

export class LineProvider implements BasePlatformProvider {
    readonly name: PlatformName = PlatformName.LINE;
    readonly enabled: boolean;

    #token: string;
    #secret: string;
    #path: string;
    #server: HttpServer;
    #client: messagingApi.MessagingApiClient | null = null;
    #messageCallbacks: MessageCallback[] = [];
    #commandCallbacks: CommandCallback[] = [];
    #seenEventIds = new Set<string>();
    #profileCache = new Map<string, CachedProfile>();

    constructor(params: LineProviderParams) {
        this.#token = params.token;
        this.#secret = params.secret ?? "";
        this.#path = params.path ?? "/line/webhook";
        this.#server = params.server ?? defaultServer;
        this.enabled = this.#token !== "";
    }

    /**
     * Allows injecting a custom MessagingApiClient (useful for testing).
     */
    setClient(client: messagingApi.MessagingApiClient | null): void {
        this.#client = client;
    }

    async start(): Promise<void> {
        if (!this.enabled) return;

        this.#client = new messagingApi.MessagingApiClient({
            channelAccessToken: this.#token,
        });

        this.#server.post(this.#path, async ({ request, set }) => {
            const rawBody = await request.text();
            const signature = request.headers.get("x-line-signature");
            const result = await this.handleWebhookPayload(rawBody, signature);
            if (!result.success) {
                set.status = result.statusCode || 400;
                return { error: result.error };
            }
            return { status: "ok" };
        });

        console.info(`[LineProvider] Webhook route registered at ${this.#path}`);
    }

    async stop(): Promise<void> {
        this.#client = null;
    }

    onMessage(cb: MessageCallback): void {
        this.#messageCallbacks.push(cb);
    }

    onCommand(cb: CommandCallback): void {
        this.#commandCallbacks.push(cb);
    }

    #markEventSeen(eventId?: string): boolean {
        if (!eventId) return false;
        if (this.#seenEventIds.has(eventId)) {
            return true;
        }
        this.#seenEventIds.add(eventId);
        if (this.#seenEventIds.size > MAX_SEEN_EVENT_IDS) {
            const oldest = this.#seenEventIds.values().next().value;
            if (oldest !== undefined) {
                this.#seenEventIds.delete(oldest);
            }
        }
        return false;
    }

    async #resolveDisplayName(event: webhook.Event, fallbackId: string): Promise<string> {
        const userId = event.source?.userId;
        if (!userId || !this.#client) return fallbackId;

        const cached = this.#profileCache.get(userId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.displayName;
        }

        try {
            let displayName: string | undefined;
            if (event.source?.type === "group" && "groupId" in event.source && event.source.groupId) {
                const profile = await this.#client.getGroupMemberProfile(event.source.groupId, userId);
                displayName = profile.displayName;
            } else if (event.source?.type === "room" && "roomId" in event.source && event.source.roomId) {
                const profile = await this.#client.getRoomMemberProfile(event.source.roomId, userId);
                displayName = profile.displayName;
            } else {
                const profile = await this.#client.getProfile(userId);
                displayName = profile.displayName;
            }

            if (displayName) {
                this.#profileCache.set(userId, {
                    displayName,
                    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
                });
                return displayName;
            }
        } catch {
            // Silently fall back to userId if profile lookup fails (e.g. unadded friend in group)
        }

        return fallbackId;
    }

    async handleWebhookPayload(
        rawBody: string,
        signature?: string | null,
        options?: { awaitCompletion?: boolean },
    ): Promise<WebhookResult> {
        if (this.#secret) {
            if (!signature || !validateSignature(rawBody, this.#secret, signature)) {
                return { success: false, statusCode: 401, error: "Invalid signature" };
            }
        }

        let body: webhook.CallbackRequest;
        try {
            body = JSON.parse(rawBody);
        } catch (err) {
            console.error("[LineProvider] Invalid JSON payload in webhook body:", err);
            return { success: false, statusCode: 400, error: "Invalid JSON payload" };
        }

        const events = body.events ?? [];
        const processingPromise = Promise.all(
            events.map((event) =>
                this.#handleEvent(event).catch((err) => {
                    console.error("[LineProvider] Unhandled error processing event:", err);
                }),
            ),
        );

        if (options?.awaitCompletion) {
            await processingPromise;
        } else {
            // Immediately acknowledge LINE webhook with 200 OK to avoid retries
            void processingPromise;
        }

        return { success: true };
    }

    async #handleEvent(event: webhook.Event): Promise<void> {
        if (event.type !== "message") {
            return;
        }

        const webhookEventId = (event as { webhookEventId?: string }).webhookEventId;
        if (this.#markEventSeen(webhookEventId)) {
            console.info(`[LineProvider] Skipping duplicate webhook event ${webhookEventId}`);
            return;
        }

        const sourceId = extractSourceId(event);
        if (!sourceId) return;

        const messageEvent = event as webhook.MessageEvent;
        const replyToken = messageEvent.replyToken;
        if (!replyToken) {
            console.warn("[LineProvider] Missing replyToken on message event; skipping to avoid pushMessage billing");
            return;
        }

        const softDeadlineMs = Number(Bun.env.LINE_SOFT_DEADLINE_MS) || DEFAULT_LINE_SOFT_DEADLINE_MS;
        const hardDeadlineMs = Number(Bun.env.LINE_HARD_DEADLINE_MS) || DEFAULT_LINE_HARD_DEADLINE_MS;

        const showLoading = () => {
            if (this.#client?.showLoadingAnimation && event.source?.type === "user" && event.source.userId) {
                this.#client.showLoadingAnimation({
                    chatId: sourceId,
                    loadingSeconds: 60,
                }).catch((err) => {
                    console.warn("[LineProvider] Failed to show loading animation:", err);
                });
            }
        };

        const replyFn = async (text: string, metadata?: ReplyMetadata) => {
            await this.sendReplyWithToken(replyToken, text, metadata);
        };

        switch (event.message.type) {
        case "text": {
            const textMessage = messageEvent.message as webhook.TextMessageContent;
            let content = textMessage.text.trim();
            if (!content) return;

            const isGroupOrRoom = event.source?.type === "group" || event.source?.type === "room";
            const requireMention = Bun.env.LINE_GROUP_REQUIRE_MENTION === "true";
            if (isGroupOrRoom && requireMention) {
                const { matched, content: stripped } = stripLineGroupMention(content);
                if (!matched || !stripped) return;
                content = stripped;
            }

            const senderId = event.source?.userId ?? sourceId;
            const nickname = await this.#resolveDisplayName(event, senderId);

            // Handle built-in slash commands (e.g. /reset, /status, /help)
            const parsedCmd = parseSlashCommand(content);
            if (parsedCmd && this.#commandCallbacks.length > 0) {
                const cmdCtx: ChatContext = {
                    platformName: PlatformName.LINE,
                    roomId: sourceId,
                    sender: { id: senderId, nickname },
                    type: "text",
                    content,
                    reply: replyFn,
                };
                for (const cb of this.#commandCallbacks) {
                    try {
                        await cb(parsedCmd.command, parsedCmd.args, cmdCtx);
                    } catch (error) {
                        console.error("[LineProvider] Error executing command callback:", error);
                    }
                }
                return;
            }

            showLoading();

            const ctx: ChatContext = {
                platformName: PlatformName.LINE,
                roomId: sourceId,
                sender: { id: senderId, nickname },
                type: "text",
                content,
                softDeadlineMs,
                hardDeadlineMs,
                reply: replyFn,
            };

            for (const cb of this.#messageCallbacks) {
                try {
                    await cb(ctx);
                } catch (error) {
                    console.error("[LineProvider] Error executing message callback:", error);
                }
            }
            break;
        }

        case "image": {
            const isGroupOrRoom = event.source?.type === "group" || event.source?.type === "room";
            if (isGroupOrRoom && Bun.env.LINE_GROUP_REQUIRE_MENTION === "true") {
                return;
            }

            const imageMessage = event.message as webhook.ImageMessageContent;
            try {
                const res = await fetch(`https://api-data.line.me/v2/bot/message/${imageMessage.id}/content`, {
                    headers: {
                        Authorization: `Bearer ${this.#token}`,
                    },
                });
                if (!res.ok) {
                    console.error(`[LineProvider] Failed to fetch image content for ${imageMessage.id}: ${res.statusText}`);
                    return;
                }

                showLoading();

                const buffer = await res.arrayBuffer();
                const id = await saveReceivedImage(buffer);
                const senderId = event.source?.userId ?? sourceId;
                const nickname = await this.#resolveDisplayName(event, senderId);

                const ctx: ChatContext = {
                    platformName: PlatformName.LINE,
                    roomId: sourceId,
                    sender: { id: senderId, nickname },
                    type: "image",
                    content: id,
                    softDeadlineMs,
                    hardDeadlineMs,
                    reply: replyFn,
                };

                for (const cb of this.#messageCallbacks) {
                    try {
                        await cb(ctx);
                    } catch (error) {
                        console.error("[LineProvider] Error executing message callback:", error);
                    }
                }
            } catch (error) {
                console.error("[LineProvider] Error handling image message:", error);
            }
            break;
        }

        default:
            console.warn(`[LineProvider] Unsupported message type: ${event.message.type}`);
            break;
        }
    }

    /**
     * Strictly uses LINE's free replyMessage API (never falls back to billed pushMessage).
     * Automatically renders Flex Message cards (arXiv, /status, /help) and attaches contextual Quick Replies.
     */
    async sendReplyWithToken(
        replyToken: string,
        content: string,
        metadata?: ReplyMetadata,
    ): Promise<void> {
        if (!this.enabled) {
            console.warn("[LineProvider] Cannot reply: Provider is disabled");
            return;
        }
        if (!this.#client) {
            console.warn("[LineProvider] Cannot reply: Client is not initialized");
            return;
        }

        const messages: messagingApi.Message[] = [];
        let isArxiv = false;
        let isSystemCard = false;

        if (metadata?.statusCard) {
            isSystemCard = true;
            messages.push(buildStatusFlexMessage(metadata.statusCard));
        } else if (metadata?.helpCard) {
            isSystemCard = true;
            messages.push(buildHelpFlexMessage(metadata.helpCard));
        } else {
            const arxivCard = parseArxivReplyCard(content);
            if (arxivCard) {
                isArxiv = true;
                messages.push(buildArxivFlexMessage(arxivCard));
            } else {
                const formatted = convertMarkdownTablesToDiscordLists(flattenArxivReply(content));
                const chunks = sliceContent(formatted, 5000).slice(0, LINE_MAX_REPLY_MESSAGES);
                for (const chunk of chunks) {
                    messages.push({ type: "text", text: chunk });
                }
            }
        }

        if (messages.length === 0) return;

        const quickReply = buildLineQuickReply({
            converged: metadata?.converged,
            isArxiv,
            isSystemCard,
            suggestions: metadata?.quickReplies,
        });
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && quickReply.items && quickReply.items.length > 0) {
            lastMessage.quickReply = quickReply;
        }

        try {
            await this.#client.replyMessage({
                replyToken,
                messages,
            });
        } catch (err) {
            console.error("[LineProvider] Failed to send replyMessage (pushMessage fallback disabled):", err);
        }
    }

    async sendText(_roomId: string, _content: string): Promise<void> {
        console.warn("[LineProvider] sendText via pushMessage is disabled; LINE replies must use replyToken via replyMessage.");
    }
}
