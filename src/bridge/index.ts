import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Platform } from "../types.ts";
import type { RelayEntry } from "../types.ts";
import { useDiscordClient } from "../platforms/discord/client.ts";
import { useMatrixClient } from "../platforms/matrix/client.ts";

const relayMapPath = join(new URL(".", import.meta.url).pathname, "../../relay.json");
const relayMap: RelayEntry[] = JSON.parse(readFileSync(relayMapPath, "utf-8"));

function findRelay(platform: Platform, roomId: string): RelayEntry | undefined {
    return relayMap.find((entry) => entry[platform] === roomId);
}

type Sender = (recipient: string, text: string) => Promise<void>;

const senders: Record<Platform, Sender> = {
    [Platform.Discord]: async (recipient, text) => {
        const client = useDiscordClient();
        const channel = await client.channels.fetch(recipient);
        if (channel?.isSendable()) {
            await channel.send(text);
        }
    },
    [Platform.Matrix]: async (recipient, text) => {
        const client = await useMatrixClient();
        await client.sendMessage(recipient, {
            msgtype: "m.text",
            format: "plain/text",
            body: text,
        });
    },
    [Platform.LINE]: async () => {
        // LINE uses reply-based messaging; broadcast not supported.
    },
};

function getSender(platform: Platform): Sender {
    const sender = senders[platform];
    if (!sender) throw new Error(`Unknown platform: ${platform}`);
    return sender;
}

export function hasRelay(platform: Platform, roomId: string): boolean {
    return !!findRelay(platform, roomId);
}

export function relayText(platform: Platform, roomId: string, text: string, senderName?: string): void {
    const recipients = findRelay(platform, roomId);
    if (!recipients) return;
    const prefixed = senderName ? `${senderName} ⬗ ${platform}\n${text}` : text;
    broadcast(platform, recipients, prefixed, false);
}

export function sendText(platform: Platform, roomId: string, text: string, included = false): void {
    const recipients = findRelay(platform, roomId);
    if (recipients) {
        broadcast(platform, recipients, text, included);
    } else {
        getSender(platform)(roomId, text);
    }
}

function broadcast(originPlatform: Platform, recipients: RelayEntry, text: string, included: boolean): void {
    for (const [targetPlatform, targetRoomId] of Object.entries(recipients)) {
        if (!included && targetPlatform === originPlatform) continue;
        if (!targetRoomId) continue;
        getSender(targetPlatform as Platform)(targetRoomId, text);
    }
}
