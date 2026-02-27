import finder from "./finder.ts";
import { send, broadcast } from "./sender.ts";

export const hasRelay = (platform: string, roomId: string) => {
    return !!finder(platform, roomId);
};

export const relayText = (
    platform: string,
    roomId: string,
    text: string,
    name?: string,
) => {
    const recipients = finder(platform, roomId);
    if (!recipients) {
        return;
    }
    text = `${name} ⬗ ${platform}\n${text}`;
    broadcast(platform, recipients, text, false);
};

export const sendText = (
    platform: string,
    roomId: string,
    text: string,
    included = false,
) => {
    const recipients = finder(platform, roomId);
    if (recipients) {
        broadcast(platform, recipients, text, included);
    } else {
        send(platform, roomId, text);
    }
};
