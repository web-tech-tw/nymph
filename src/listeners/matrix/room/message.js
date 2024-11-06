"use strict";

const {useClient} = require("../../../clients/matrix");
const {chatWithAI} = require("../../../clients/langchain");

const {
    PLATFORM_MATRIX,
} = require("../../../init/const");

const {
    relayText,
    useSendText,
} = require("../../../bridges");

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
    const clientId = await client.getUserId();

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

    const sendText = useSendText(
        PLATFORM_MATRIX,
        roomId,
    );

    requestContent = requestContent.slice(prefix.length).trim();
    if (!requestContent) {
        sendText("所收到的訊息意圖不明。");
        return;
    }

    let responseContent;
    try {
        responseContent = await chatWithAI(roomId, requestContent);
    } catch (error) {
        console.error(error);
        sendText("所收到的訊息意圖不明。");
        return;
    }

    responseContent = responseContent.trim();
    if (!responseContent) {
        sendText("所收到的訊息意圖不明。");
        return;
    }

    sendText(responseContent);
};
