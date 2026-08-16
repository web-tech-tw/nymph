import type { webhook } from "@line/bot-sdk";

export function extractSourceId(event: webhook.Event): string | null {
    if (!("source" in event) || !event.source) return null;
    const { source } = event;
    if (source.type === "group") return source.groupId;
    if (source.type === "room") return source.roomId;
    if (source.type === "user") return source.userId ?? null;
    return null;
}
