import { useMatrixClient, fetchMatrixUserId, startMatrixSync } from "./client.ts";
import { chatWithAI } from "../../agents/chat.ts";
import { relayText, sendText } from "../../bridge/index.ts";
import { COMMAND_PREFIX } from "../../constants.ts";
import { Platform } from "../../types.ts";
import type { PlatformAdapter } from "../types.ts";

interface MatrixEvent {
    event_id: string;
    sender: string;
    content: { body?: string; msgtype?: string };
    [key: string]: unknown;
}

function say(roomId: string, text: string): void {
    sendText(Platform.Matrix, roomId, text, true);
}

function onFailedDecryption(roomId: string, event: MatrixEvent, error: Error): void {
    console.error(`Failed to decrypt ${roomId} ${event.event_id}:`, error);
}

async function onRoomMessage(roomId: string, event: MatrixEvent): Promise<void> {
    const client = await useMatrixClient();
    const clientId = await fetchMatrixUserId(client);

    if (event.sender === clientId) return;
    await client.sendReadReceipt(roomId, event.event_id);

    const body = event.content?.body ?? "";
    relayText(Platform.Matrix, roomId, body, event.sender);

    if (!body.startsWith(COMMAND_PREFIX)) return;

    const content = body.slice(COMMAND_PREFIX.length).trim();
    if (!content) { say(roomId, "所收到的訊息意圖不明。"); return; }

    try {
        const response = await chatWithAI(roomId, content);
        say(roomId, response?.trim() || "所收到的訊息意圖不明。");
    } catch (error) {
        console.error(error);
        say(roomId, "思緒混亂，無法回覆。");
    }
}

export const matrixAdapter: PlatformAdapter = {
    platform: Platform.Matrix,

    async prepare() {
        const client = await useMatrixClient();
        const userId = await client.getUserId();
        console.info(`Matrix 身份：${userId}`);
        await startMatrixSync();
    },

    async listen() {
        const client = await useMatrixClient();
        client.on("room.failed_decryption", onFailedDecryption);
        client.on("room.message", onRoomMessage);
    },
};
