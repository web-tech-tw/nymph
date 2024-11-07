"use strict";

/**
 * This function is called when a new event is added to the timeline of a room.
 *
 * @param {string} roomId - The room that the event was sent in.
 * @param {any} event - The event that triggered this function.
 * @param {Error} error - The error that triggered this function.
 * @return {void}
 */
module.exports = async (roomId, event, error) => {
    console.error(
        `Failed to decrypt ${roomId} ${event["event_id"]} because `,
        error,
    );
};
