"use strict";
// Trasnfer messages from Discord to Matrix.

const discord = require("discord.js");

const {
    MsgType,
} = require("matrix-js-sdk");

const {
    useClient,
} = require("../clients/matrix");

const {
    find,
} = require("./utils");

const client = useClient();

/**
 * This function is called when a message is created in Discord.
 *
 * @param {discord.Message} message
 * @return {void}
 */
module.exports = async (message) => {
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
        msgtype: MsgType.Text,
        format: "plain/text",
        body: `${username} ⬗ Discord\n${text}`,
    });
};
