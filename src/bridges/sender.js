"use strict";
// Send messages between every platforms.

const {
    PLATFORM_DISCORD,
    PLATFORM_MATRIX,
} = require("../init/const");

const {
    useClient: useDiscordClient,
} = require("../clients/discord");

const {
    useClient: useMatrixClient,
} = require("../clients/matrix");

/**
 * This function is called to send a message to Discord.
 *
 * @param {string} recipient - The recipient of the message.
 * @param {string} text - The text of the message.
 * @return {void}
 */
const toDiscord = async (recipient, text) => {
    const client = useDiscordClient();
    const channel = await client.channels.fetch(recipient);
    await channel.send(text);
};

/**
 * This function is called to send a message to Matrix.
 *
 * @param {string} recipient - The recipient of the message.
 * @param {string} text - The text of the message.
 * @return {void}
 */
const toMatrix = async (recipient, text) => {
    const client = await useMatrixClient();
    await client.sendMessage(recipient, {
        msgtype: "m.text",
        format: "plain/text",
        body: text,
    });
};

// Map of platforms to send messages.
const messageSender = {
    [PLATFORM_DISCORD]: toDiscord,
    [PLATFORM_MATRIX]: toMatrix,
};

exports.send = (platform, recipient, text) => {
    const sendMessage = messageSender[platform];
    if (!sendMessage) {
        throw new Error(`unknown platform: ${platform}`);
    }
    sendMessage(recipient, text);
};

exports.broadcast = (platform, recipients, text, skip=false) => {
    for (const [itemPlatform, itemRoomId] of Object.entries(recipients)) {
        if (skip && itemPlatform === platform) {
            continue;
        }
        const sendMessage = messageSender[itemPlatform];
        if (!sendMessage) {
            throw new Error(`unknown platform: ${itemPlatform}`);
        }
        sendMessage(itemRoomId, text);
    }
};
