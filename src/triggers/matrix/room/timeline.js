"use strict";

const {Room, RoomEvent, MsgType} = require("matrix-js-sdk");

const matrixToDiscord = require("../../../bridges/matrix_discord");

const {useClient} = require("../../../clients/matrix");
const {usePrompts} = require("../../../clients/gemini");

const prompts = require("../../../../prompts.json");

const client = useClient();
const useChatSession = usePrompts(prompts);
const prefix = "Nymph ";

/**
 * This function is called when a new event is added to the timeline of a room.
 *
 * @param {RoomEvent} roomEvent - The event that triggered this function.
 * @param {Room} room - The room that the event was sent in.
 * @param {Date} toStartOfTimeline - The date of the first event.
 * @return {void}
 */
module.exports = async (roomEvent, room, toStartOfTimeline) => {
    if (
        roomEvent.getType() !== "m.room.message" ||
        roomEvent.event.sender === client.getUserId()
    ) {
        return;
    }

    matrixToDiscord(roomEvent, room, toStartOfTimeline);

    let requestContent = roomEvent.event.content.body;

    if (!requestContent.startsWith(prefix)) {
        return;
    }
    requestContent = requestContent.slice(prefix.length).trim();

    if (!requestContent) {
        await client.sendMessage(room.roomId, {
            msgtype: MsgType.Text,
            format: "plain/text",
            body: "所收到的訊息意圖不明。",
        });
        return;
    }

    const chatSession = useChatSession(room.roomId);
    let result;
    try {
        result = await chatSession.sendMessage(requestContent);
    } catch (error) {
        console.error(error);
        await client.sendMessage(room.roomId, {
            msgtype: MsgType.Text,
            format: "plain/text",
            body: "思緒混亂，無法回覆。",
        });
        return;
    }

    const responseContent = result.response.text().trim();
    if (!responseContent) {
        await client.sendMessage(room.roomId, {
            msgtype: MsgType.Text,
            format: "plain/text",
            body: "無法正常回覆，請換個說法試試。",
        });
        return;
    }

    await client.sendMessage(room.roomId, {
        msgtype: MsgType.Text,
        format: "plain/text",
        body: responseContent,
    });
};
