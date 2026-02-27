import { useClient, fetchUserId } from "../../../clients/matrix.ts";
import { chatWithAI } from "../../../clients/langchain.ts";
import { PLATFORM_MATRIX } from "../../../init/const.ts";
import { relayText, sendText } from "../../../bridges/index.ts";

const hey = (roomId: string) => ({
    say: (text: string) => {
        sendText(PLATFORM_MATRIX, roomId, text, true);
    },
});

const prefix = "Nymph ";

export default async (roomId: string, event: any) => {
    const client = await useClient();
    const clientId = await fetchUserId(client as any);

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
