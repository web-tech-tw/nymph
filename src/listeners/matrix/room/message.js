"use strict";

const {
    useClient,
    fetchUserId,
} = require("../../../clients/matrix");
const {
    chatWithAI,
} = require("../../../clients/langchain");

const {
    PLATFORM_MATRIX,
} = require("../../../init/const");

const {
    relayText,
    sendText,
} = require("../../../bridges");

const hey = (roomId) => ({
    say: (text) => {
        sendText(PLATFORM_MATRIX, roomId, text, true);
    },
});

const prefix = "Nymph ";

/**
 * This function is called when a new event is added to the timeline of a room.
 *
 * @param {string} roomId - The room that the event was sent in.
 * @param {any} event - The event that triggered this function.
 * @return {void}
 */
module.exports = async (roomId, event) => {
    const client = await useClient();
    const clientId = await fetchUserId(client);

    const {
        event_id: eventId,
        sender: senderId,
    } = event;

    if (senderId === clientId) {
        return;
    }

    await client.sendReadReceipt(roomId, eventId);

    let requestContent = event.content.body;
    relayText(
        PLATFORM_MATRIX,
        roomId,
        requestContent,
        senderId,
    );
    if (!requestContent.startsWith(prefix)) {
        return;
    }

    requestContent = requestContent.slice(prefix.length).trim();
    if (!requestContent) {
        hey(roomId).say("所收到的訊息意圖不明。");
        return;
    }

    let responseContent;
    try {
        responseContent = await chatWithAI(roomId, requestContent);
    } catch (error) {
        console.error(error);
        hey(roomId).say("所收到的訊息意圖不明。");
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        hey(roomId).say("所收到的訊息意圖不明。");
        return;
    }

    hey(roomId).say(responseContent);
};
