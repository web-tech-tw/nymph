import { messagingApi, validateSignature, type webhook } from "@line/bot-sdk";
import { PlatformName } from "../types/provider";
import type {
    BasePlatformProvider,
    MessageCallback,
    CommandCallback,
    ChatContext
} from "../types/provider";
import type { LineProviderParams, WebhookResult } from "../types/line";
import { server as defaultServer, type HttpServer } from "../routes";
import { sliceContent } from "../utils/text";
import { extractSourceId } from "../utils/line";
import { saveReceivedImage } from "../utils/media";

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

    constructor(params: LineProviderParams) {
        this.#token = params.token;
        this.#secret = params.secret ?? "";
        this.#path = params.path ?? "/line/webhook";
        this.#server = params.server ?? defaultServer;
        this.enabled = this.#token !== "";
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

    async handleWebhookPayload(rawBody: string, signature?: string | null): Promise<WebhookResult> {
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
        await Promise.all(events.map((event) => this.#handleEvent(event)));

        return { success: true };
    }

    async #handleEvent(event: webhook.Event): Promise<void> {
        if (event.type !== "message") {
            return;
        }

        const sourceId = extractSourceId(event);
        if (!sourceId) return;

        switch (event.message.type) {
        case "text": {
            const messageEvent = event as webhook.MessageEvent;
            const textMessage = messageEvent.message as webhook.TextMessageContent;
            const content = textMessage.text.trim();
            if (!content) return;

            if (this.#client && event.source?.userId) {
                this.#client.showLoadingAnimation({
                    chatId: sourceId,
                    loadingSeconds: 15,
                }).catch((err) => {
                    console.warn("[LineProvider] Failed to show loading animation:", err);
                });
            }

            const ctx: ChatContext = {
                platformName: PlatformName.LINE,
                roomId: sourceId,
                sender: {
                    id: event.source?.userId ?? sourceId,
                    nickname: event.source?.userId ?? sourceId,
                },
                type: "text",
                content,
                reply: async (text: string) => {
                    await this.sendText(sourceId, text);
                },
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

                if (this.#client && event.source?.userId) {
                    this.#client.showLoadingAnimation({
                        chatId: sourceId,
                        loadingSeconds: 15,
                    }).catch((err) => {
                        console.warn("[LineProvider] Failed to show loading animation:", err);
                    });
                }

                const buffer = await res.arrayBuffer();
                const id = await saveReceivedImage(buffer);

                const ctx: ChatContext = {
                    platformName: PlatformName.LINE,
                    roomId: sourceId,
                    sender: {
                        id: event.source?.userId ?? sourceId,
                        nickname: event.source?.userId ?? sourceId,
                    },
                    type: "image",
                    content: id,
                    reply: async (text: string) => {
                        await this.sendText(sourceId, text);
                    },
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

    async sendText(roomId: string, content: string): Promise<void> {
        if (!this.enabled) {
            console.warn("[LineProvider] Cannot send text: Provider is disabled");
            return;
        }
        if (!this.#client) {
            console.warn("[LineProvider] Cannot send text: Client is not initialized");
            return;
        }

        const chunks = sliceContent(content, 5000);
        for (const chunk of chunks) {
            try {
                await this.#client.pushMessage({
                    to: roomId,
                    messages: [{ type: "text", text: chunk }],
                });
            } catch (err) {
                console.error(`[LineProvider] Failed to send message to room ${roomId}:`, err);
            }
        }
    }
}