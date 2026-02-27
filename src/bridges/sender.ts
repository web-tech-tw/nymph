import { PLATFORM_DISCORD, PLATFORM_MATRIX } from "../init/const.ts";
import { useClient as useDiscordClient } from "../clients/discord.ts";
import { useClient as useMatrixClient } from "../clients/matrix.ts";

/**
 * Send a message to Discord channel.
 */
const toDiscord = async (recipient: string, text: string) => {
    const client = useDiscordClient();
    const channel = await client.channels.fetch(recipient);
    await (channel as any).send(text);
};

/**
 * Send a message to Matrix room.
 */
const toMatrix = async (recipient: string, text: string) => {
    const client = await useMatrixClient();
    await client.sendMessage(recipient, {
        msgtype: "m.text",
        format: "plain/text",
        body: text,
    });
};

const messageSender: Record<string, (recipient: string, text: string) => Promise<void>> = {
    [PLATFORM_DISCORD]: toDiscord,
    [PLATFORM_MATRIX]: toMatrix,
};

export const send = (platform: string, recipient: string, text: string) => {
    const sendMessage = messageSender[platform];
    if (!sendMessage) {
        throw new Error(`unknown platform: ${platform}`);
    }
    sendMessage(recipient, text);
};

export const broadcast = (
    platform: string,
    recipients: Record<string, string>,
    text: string,
    included = false,
) => {
    for (const [itemPlatform, itemRoomId] of Object.entries(recipients)) {
        if (!included && itemPlatform === platform) {
            continue;
        }
        const sendMessage = messageSender[itemPlatform];
        if (!sendMessage) {
            throw new Error(`unknown platform: ${itemPlatform}`);
        }
        sendMessage(itemRoomId, text);
    }
};
