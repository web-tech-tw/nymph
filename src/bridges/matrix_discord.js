"use strict";
// Trasnfer messages from Discord to Matrix.

const {
    RoomEvent,
    Room,
} = require("matrix-js-sdk");

const {
    useClient,
} = require("../clients/discord");

const {
    find,
} = require("./utils");

const client = useClient();

/**
 * This function is called when a new event is added to the timeline of a room.
 *
 * @param {RoomEvent} roomEvent - The event that triggered this function.
 * @param {Room} room - The room that the event was sent in.
 * @param {Date} _toStartOfTimeline - The date of the first event.
 * @return {void}
 */
module.exports = async (roomEvent, room, _toStartOfTimeline) => {
    const {roomId} = room;
    const {
        discordChannelId: channelId,
    } = find("matrixRoomId", roomId);

    const {sender: username} = roomEvent.event;
    const {body: text} = roomEvent.event.content;

    const channel = await client.channels.fetch(channelId);
    await channel.send(`\`${username}\` ⬗ Matrix\n${text}`);
};
