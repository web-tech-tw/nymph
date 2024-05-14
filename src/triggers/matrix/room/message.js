"use strict";

const matrixToDiscord = require("../../../bridges/matrix_discord");

const {useClient} = require("../../../clients/matrix");
const {usePrompts} = require("../../../clients/gemini");

const prompts = require("../../../../prompts.json");

const useChatSession = usePrompts(prompts);
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

    const {
        event_id: eventId,
        sender: senderId,
    } = event;

    if (senderId === await client.getUserId()) {
        return;
    }

    await client.sendReadReceipt(roomId, eventId);

    matrixToDiscord(roomId, event);

    let requestContent = event.content.body;

    if (!requestContent.startsWith(prefix)) {
        return;
    }
    requestContent = requestContent.slice(prefix.length).trim();

    if (!requestContent) {
        await client.sendMessage(roomId, {
            msgtype: "m.text",
            format: "plain/text",
            body: "所收到的訊息意圖不明。",
        });
        return;
    }

    const chatSession = useChatSession(roomId);
    let result;
    try {
        result = await chatSession.sendMessage(requestContent);
    } catch (error) {
        console.error(error);
        await client.sendMessage(roomId, {
            msgtype: "m.text",
            format: "plain/text",
            body: "思緒混亂，無法回覆。",
        });
        return;
    }

    const responseContent = result.response.text().trim();
    if (!responseContent) {
        await client.sendMessage(roomId, {
            msgtype: "m.text",
            format: "plain/text",
            body: "無法正常回覆，請換個說法試試。",
        });
        return;
    }

    await client.sendMessage(roomId, {
        msgtype: "m.text",
        format: "plain/text",
        body: responseContent,
    });
};
