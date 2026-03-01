import { envRequired } from "../../config/index.ts";
import { messagingApi, middleware as createMiddleware } from "@line/bot-sdk";

interface LineConfig {
    channelAccessToken: string;
    channelSecret: string;
}

function getConfig(): LineConfig {
    return {
        channelAccessToken: envRequired("LINE_CHANNEL_ACCESS_TOKEN"),
        channelSecret: envRequired("LINE_CHANNEL_SECRET"),
    };
}

let _client: messagingApi.MessagingApiClient | undefined;

export function useLineClient(refresh = false): messagingApi.MessagingApiClient {
    if (!refresh && _client) return _client;
    _client = new messagingApi.MessagingApiClient(getConfig());
    return _client;
}

let _middleware: ReturnType<typeof createMiddleware> | undefined;

export function useLineMiddleware(refresh = false): ReturnType<typeof createMiddleware> {
    if (!refresh && _middleware) return _middleware;
    _middleware = createMiddleware(getConfig());
    return _middleware;
}

/** Extract the room identifier: group > room > user. */
export function extractSourceId(event: { source: { groupId?: string; roomId?: string; userId?: string } }): string | null {
    const { groupId, roomId, userId } = event.source;
    return groupId ?? roomId ?? userId ?? null;
}
