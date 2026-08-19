import { PIPELINE_CONFIG } from "../config";
import type {
    RawMessageDoc,
    ParsedMessage,
    MergedMessageBlock,
    MessageType,
} from "../types";

const SYSTEM_SUFFIXES: Array<{ suffix: string; type: MessageType }> = [
    { suffix: "加入聊天", type: "join" },
    { suffix: "退出聊天", type: "leave" },
    { suffix: "已收回訊息", type: "recall" },
    { suffix: "您已收回訊息", type: "recall" },
];

/**
 * Parse date ("2024.08.22 星期四") and time ("10:40") into millisecond timestamp
 */
export function parseTimestampMs(dateStr: string, timeStr: string): number {
    const dateMatch = dateStr.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);

    if (!dateMatch || !timeMatch) {
        return 0;
    }

    const year = Number.parseInt(dateMatch[1] ?? "1970", 10);
    const month = Number.parseInt(dateMatch[2] ?? "1", 10) - 1;
    const day = Number.parseInt(dateMatch[3] ?? "1", 10);
    const hour = Number.parseInt(timeMatch[1] ?? "0", 10);
    const minute = Number.parseInt(timeMatch[2] ?? "0", 10);

    return new Date(Date.UTC(year, month, day, hour, minute)).getTime();
}

/**
 * Pass 1: Derive known author names by prefix frequency analysis
 */
export function collectKnownAuthors(
    rawContents: string[],
    minCount = PIPELINE_CONFIG.thresholds.authorMinOccurrences,
    maxTokens = PIPELINE_CONFIG.thresholds.maxAuthorTokens,
): Set<string> {
    const freq = new Map<string, number>();

    for (const raw of rawContents) {
        const trimmed = raw.trim();
        if (!trimmed) continue;

        // Skip known system suffixes early
        let isSystem = false;
        for (const { suffix } of SYSTEM_SUFFIXES) {
            if (trimmed.endsWith(suffix)) {
                const authorCandidate = trimmed.slice(0, trimmed.length - suffix.length).trim();
                if (authorCandidate) {
                    freq.set(authorCandidate, (freq.get(authorCandidate) ?? 0) + 1);
                }
                isSystem = true;
                break;
            }
        }
        if (isSystem) continue;

        const tokens = trimmed.split(" ");
        for (let i = 1; i <= Math.min(maxTokens, tokens.length); i++) {
            if (i < tokens.length) {
                const candidate = tokens.slice(0, i).join(" ").trim();
                if (candidate) {
                    freq.set(candidate, (freq.get(candidate) ?? 0) + 1);
                }
            }
        }
    }

    const authors = new Set<string>();
    for (const [candidate, count] of freq) {
        if (count >= minCount) {
            authors.add(candidate);
        }
    }
    return authors;
}

/**
 * Match author from raw line using longest-prefix match on known authors
 */
export function matchAuthor(
    raw: string,
    knownAuthors: Set<string>,
): { author: string; content: string; confident: boolean } {
    const sorted = [...knownAuthors].sort((a, b) => b.length - a.length);

    for (const author of sorted) {
        if (raw === author) {
            return { author, content: "", confident: true };
        }
        if (raw.startsWith(author + " ")) {
            return {
                author,
                content: raw.slice(author.length + 1).trim(),
                confident: true,
            };
        }
    }

    // Fallback: split on first space
    const spaceIdx = raw.indexOf(" ");
    return {
        author: spaceIdx === -1 ? raw : raw.slice(0, spaceIdx),
        content: spaceIdx === -1 ? "" : raw.slice(spaceIdx + 1).trim(),
        confident: false,
    };
}

/**
 * Classify a raw message document into structured ParsedMessage
 */
export function parseRawMessage(
    doc: RawMessageDoc,
    knownAuthors: Set<string>,
): ParsedMessage {
    const raw = doc.content.trim();
    const timestampMs = parseTimestampMs(doc.date, doc.time);

    // 1. Check system event suffixes
    for (const { suffix, type } of SYSTEM_SUFFIXES) {
        if (raw.endsWith(suffix)) {
            const author = raw.slice(0, raw.length - suffix.length).trim();
            return {
                id: doc._id,
                date: doc.date,
                time: doc.time,
                timestampMs,
                author: author || "System",
                content: suffix,
                type,
                authorConfident: knownAuthors.has(author),
            };
        }
    }

    // 2. Extract author and content
    const { author, content, confident } = matchAuthor(raw, knownAuthors);

    // 3. Check sticker / media noise
    if (content === "貼圖" || content === "[貼圖]" || content === "照片" || content === "[照片]" || content === "影片" || content === "[影片]") {
        return {
            id: doc._id,
            date: doc.date,
            time: doc.time,
            timestampMs,
            author,
            content,
            type: "sticker",
            authorConfident: confident,
        };
    }

    return {
        id: doc._id,
        date: doc.date,
        time: doc.time,
        timestampMs,
        author,
        content,
        type: "message",
        authorConfident: confident,
    };
}

/**
 * Merge contiguous messages from the same author within the merge window (default 45s)
 */
export function mergeContiguousMessages(
    messages: ParsedMessage[],
    mergeWindowSeconds = PIPELINE_CONFIG.thresholds.continuousMergeSeconds,
): MergedMessageBlock[] {
    const validMessages = messages.filter((m) => m.type === "message" && m.content.trim().length > 0);
    if (!validMessages.length) return [];

    const blocks: MergedMessageBlock[] = [];
    let currentBlock: MergedMessageBlock | null = null;
    const mergeWindowMs = mergeWindowSeconds * 1000;

    for (const msg of validMessages) {
        if (!currentBlock) {
            currentBlock = {
                date: msg.date,
                startTime: msg.time,
                endTime: msg.time,
                startTimestampMs: msg.timestampMs,
                endTimestampMs: msg.timestampMs,
                author: msg.author,
                content: msg.content,
                rawMessageIds: [msg.id],
            };
            continue;
        }

        const isSameAuthor = currentBlock.author === msg.author;
        const isWithinWindow = msg.timestampMs - currentBlock.endTimestampMs <= mergeWindowMs && msg.timestampMs >= currentBlock.endTimestampMs;

        if (isSameAuthor && isWithinWindow) {
            currentBlock.content += "\n" + msg.content;
            currentBlock.endTime = msg.time;
            currentBlock.endTimestampMs = msg.timestampMs;
            currentBlock.rawMessageIds.push(msg.id);
        } else {
            blocks.push(currentBlock);
            currentBlock = {
                date: msg.date,
                startTime: msg.time,
                endTime: msg.time,
                startTimestampMs: msg.timestampMs,
                endTimestampMs: msg.timestampMs,
                author: msg.author,
                content: msg.content,
                rawMessageIds: [msg.id],
            };
        }
    }

    if (currentBlock) {
        blocks.push(currentBlock);
    }

    return blocks;
}

/**
 * Build a global author registry from deterministic historical system events
 */
export async function buildGlobalAuthorRegistry(
    collection: { find: (query: object, options?: object) => { toArray: () => Promise<Array<{ content: string }>> } },
): Promise<Set<string>> {
    const systemDocs = await collection
        .find(
            { content: { $regex: "(加入聊天|退出聊天|已收回訊息|您已收回訊息)$" } },
            { projection: { content: 1 } },
        )
        .toArray();

    const authors = new Set<string>();
    for (const doc of systemDocs) {
        for (const { suffix } of SYSTEM_SUFFIXES) {
            if (doc.content.endsWith(suffix)) {
                const name = doc.content.slice(0, doc.content.length - suffix.length).trim();
                if (name) authors.add(name);
                break;
            }
        }
    }
    return authors;
}

/**
 * Process a batch of raw messages into merged message blocks
 */
export function extractAndDenoise(
    rawDocs: RawMessageDoc[],
    globalAuthors?: Set<string>,
): MergedMessageBlock[] {
    const dailyAuthors = collectKnownAuthors(rawDocs.map((d) => d.content));
    const knownAuthors = globalAuthors
        ? new Set([...globalAuthors, ...dailyAuthors])
        : dailyAuthors;
    const parsed = rawDocs.map((doc) => parseRawMessage(doc, knownAuthors));
    return mergeContiguousMessages(parsed);
}
