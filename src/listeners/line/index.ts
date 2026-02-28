
import {
    useClient,
} from "../../clients/line.ts";

import message from "./message/index.ts";

const triggers: Record<string, any> = {
    message: message,
};

export const useDispatcher = () => async (event: any) => {
    if (!Object.hasOwn(triggers, event.type)) {
        return;
    }
    await triggers[event.type](event);
};

export const prepare = async () => {
    const client = useClient();

    const showStartupMessage = async () => {
        const {displayName, basicId} = await client.getBotInfo();
        console.info(`LINE 身份：${displayName} (${basicId})`);
    };

    showStartupMessage();
};

export const listen = () => {};
