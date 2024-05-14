"use strict";
// Trasnfer messages from Discord to Matrix.

const discord = require("discord.js");

const {
    useClient,
} = require("../clients/matrix");

const {
    find,
} = require("./utils");

/**
 * This function is called when a message is created in Discord.
 *
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
    const client = await useClient();

    const {channelId} = message;

    const relayTarget = find("discordChannelId", channelId);
    if (!relayTarget) {
        return;
    }
    const {
        matrixRoomId: roomId,
    } = relayTarget;

    const {username} = message.author;
    const {content: text} = message;

    await client.sendMessage(roomId, {
        msgtype: "m.text",
        format: "plain/text",
        body: `${username} ⬗ Discord\n${text}`,
    });
};
