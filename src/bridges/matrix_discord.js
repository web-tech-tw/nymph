"use strict";
// Trasnfer messages from Discord to Matrix.

const {
    useClient,
} = require("../clients/discord");

const {
    find,
} = require("./utils");

/**
 * This function is called when a new event is added to the timeline of a room.
 *
 * @param {string} roomId - The room that the event was sent in.
 * @param {any} event - The event that triggered this function.
 * @return {void}
 */
module.exports = async (roomId, event) => {
    const client = await useClient();

    const relayTarget = find("matrixRoomId", roomId);
    if (!relayTarget) {
        return;
    }
    const {
        discordChannelId: channelId,
    } = relayTarget;

    const {sender: username, content} = event;
    const {body: text} = content;

    const channel = await client.channels.fetch(channelId);
    await channel.send(`\`${username}\` ⬗ Matrix\n${text}`);
};
