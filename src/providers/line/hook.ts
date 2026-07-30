import { Router } from "express";
import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { HookProvider } from "../../types/provider/hook.ts";
import { useLineClient, useLineMiddleware, extractSourceId } from "./client.ts";
import { COMMAND_PREFIX } from "../../constants.ts";
import { chatWithAI, sliceContent } from "../../agents/chat.ts";
import type { MessageEvent, TextEventMessage } from "@line/bot-sdk";

async function onMessage(event: MessageEvent): Promise<void> {
    if (event.message.type !== "text") return;

    const client = useLineClient();
    const { replyToken, source, message } = event;
    const { type: sourceType } = source;
    const { quoteToken, text: messageText } = message as TextEventMessage;

    let content = messageText;
    if (sourceType !== "user" && !content.startsWith(COMMAND_PREFIX)) return;
    if (content.startsWith(COMMAND_PREFIX)) {
        content = content.slice(COMMAND_PREFIX.length).trim();
    }

    const sourceId = extractSourceId(event);
    if (sourceType === "user" && sourceId) {
        await client.showLoadingAnimation({ chatId: sourceId, loadingSeconds: 5 });
    }

    if (!content) {
        await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: "所收到的訊息意圖不明。", quoteToken }],
        });
        return;
    }

    try {
        if (!sourceId) throw new Error("Source ID not found");
        const responseContent = (await chatWithAI(sourceId, content)).trim();
        if (!responseContent) {
            await client.replyMessage({
                replyToken,
                messages: [{ type: "text", text: "無法正常回覆，請換個說法試試。", quoteToken }],
            });
            return;
        }

        const snippets = sliceContent(responseContent, 5000);
        const messages: Array<{ type: "text"; text: string; quoteToken?: string }> = [];
        messages.push({ type: "text", text: snippets.shift()!, quoteToken });
        for (const snippet of snippets) {
            messages.push({ type: "text", text: snippet });
        }
        await client.replyMessage({ replyToken, messages });
    } catch (error) {
        console.error(error);
        await client.replyMessage({
            replyToken,
            messages: [{ type: "text", text: "思緒混亂，無法回覆。", quoteToken }],
        });
    }
}

export class LINEHook extends ProviderBase implements HookProvider {
    public router: Router;

    constructor() {
        super();
        this.router = Router();
        if (this.enabled) {
            this.router.post("/line", useLineMiddleware(), async (req, res) => {
                const events = (req.body as { events?: MessageEvent[] }).events ?? [];
                await Promise.all(events.map(onMessage));
                res.sendStatus(200);
            });
        }
    }

    public get type(): ProviderType {
        return "line";
    }
}

export default LINEHook;
