import crypto from "node:crypto";
import {readLines} from "./text.ts";

export interface Message {
  date: string;
  time: string;
  content: string;
  hash: string;
}

const DATE_REGEX = /^(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})(?:\s+(.+))?$/;
const TIME_REGEX = /^(\d{1,2}:\d{2})\s+(.*)$/;

function generateHash(date: string, time: string, content: string): string {
    return crypto
        .createHash("sha3-256")
        .update(`${date}\n${time}\n${content}`)
        .digest("hex");
}

export async function* parseChatStream(
    filePath: string,
): AsyncGenerator<Message, void, unknown> {
    let currentDate = "";
    let currentMsg: Omit<Message, "hash"> | null = null;

    function flushMsg(): Message | null {
        if (!currentMsg) return null;
        const content = currentMsg.content.trimEnd();
        const hash = generateHash(currentMsg.date, currentMsg.time, content);
        const msg = {...currentMsg, content, hash};
        currentMsg = null;
        return msg;
    }

    for await (const line of readLines(filePath)) {
        const dateMatch = line.match(DATE_REGEX);
        if (dateMatch) {
            const matchedDate = dateMatch[1];
            if (dateMatch.length < 2 || matchedDate === undefined) {
                throw new Error(`Invalid date match format for line: "${line}"`);
            }

            const flushed = flushMsg();
            if (flushed) yield flushed;

            currentDate = line.trim();
            continue;
        }

        const timeMatch = line.match(TIME_REGEX);
        if (!timeMatch) {
            if (currentMsg) {
                currentMsg.content += "\n" + line;
            }
            continue;
        }

        const time = timeMatch[1];
        const content = timeMatch[2];
        if (timeMatch.length < 3 || time === undefined || content === undefined) {
            throw new Error(`Invalid time match format for line: "${line}"`);
        }

        const flushed = flushMsg();
        if (flushed) yield flushed;

        currentMsg = {
            date: currentDate,
            time,
            content,
        };
    }

    const lastMsg = flushMsg();
    if (lastMsg) yield lastMsg;
}

export async function parseChat(filePath: string): Promise<Message[]> {
    const messages: Message[] = [];
    for await (const msg of parseChatStream(filePath)) {
        messages.push(msg);
    }
    return messages;
}
