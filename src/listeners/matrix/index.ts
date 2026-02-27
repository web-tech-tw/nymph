
import {
    useClient,
    startSync,
} from "../../clients/matrix.ts";

import failedDecryption from "./room/failed_decryption.ts";
import message from "./room/message.ts";

const triggers: Record<string, any> = {
    "room.failed_decryption": failedDecryption,
    "room.message": message,
};

export const prepare = async () => {
    const client = await useClient();

    const showStartupMessage = async () => {
        const userId = await client.getUserId();
        console.info(`Matrix 身份：${userId}`);
    };

    await showStartupMessage();
    await startSync();
};

export const listen = async () => {
    const client = await useClient();
    for (const [key, trigger] of Object.entries(triggers)) {
        client.on(key, trigger);
    }
};
