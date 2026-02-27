// LINE is an opensource instant messaging platform.

import { getMust } from "../config.ts";
import {
    messagingApi,
    middleware as createMiddleware,
} from "@line/bot-sdk";

const newClient = () => {
    const channelAccessToken = getMust("LINE_CHANNEL_ACCESS_TOKEN");
    const channelSecret = getMust("LINE_CHANNEL_SECRET");
    const config = { channelAccessToken, channelSecret };
    return new messagingApi.MessagingApiClient(config);
};

const newMiddleware = (config: any) => {
    return createMiddleware(config);
};

let client: any;
export const useClient = (cached = true) => {
    if (cached && client) {
        return client;
    }
    client = newClient();
    return client;
};

let middleware: any;
export const useMiddleware = (cached = true) => {
    if (cached && middleware) {
        return middleware;
    }

    middleware = newMiddleware({
        channelAccessToken: getMust("LINE_CHANNEL_ACCESS_TOKEN"),
        channelSecret: getMust("LINE_CHANNEL_SECRET"),
    });
    return middleware;
};

export const whereSentMessageEvent = (event: any): string | null => {
    const { source: { userId, roomId, groupId } } = event;
    return groupId ?? roomId ?? userId ?? null;
};

export const whoSentMessageEvent = (event: any): string | null => {
    const { source: { userId } } = event;
    return userId ?? null;
};
