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
        } catch {
            return { success: false, statusCode: 400, error: "Invalid JSON payload" };
        }

        const events = body.events ?? [];
        await Promise.all(events.map((event) => this.#handleEvent(event)));

        return { success: true };
    }

    async #handleEvent(event: webhook.Event): Promise<void> {
        if (event.type !== "message" || event.message.type !== "text") {
            return;
        }

        const messageEvent = event as webhook.MessageEvent;
        const textMessage = messageEvent.message as webhook.TextMessageContent;
        const sourceId = extractSourceId(event);
        if (!sourceId) return;

        const content = textMessage.text.trim();
        if (!content) return;

        if (this.#client && event.source?.userId) {
            this.#client.showLoadingAnimation({
                chatId: sourceId,
                loadingSeconds: 15,
            }).catch(() => {});
        }

        const ctx: ChatContext = {
            platformName: PlatformName.LINE,
            roomId: sourceId,
            sender: {
                id: event.source?.userId ?? sourceId,
                nickname: event.source?.userId ?? sourceId,
            },
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
    }

    async sendText(roomId: string, content: string): Promise<void> {
        if (!this.enabled || !this.#client) return;

        const chunks = sliceContent(content, 5000);
        for (const chunk of chunks) {
            await this.#client.pushMessage({
                to: roomId,
                messages: [{ type: "text", text: chunk }],
            });
        }
    }
}