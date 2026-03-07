import { readFileSync } from "fs";

export interface IChatMessage {
    date: string;             // "YYYY/MM/DD" — 來自日期標題列（可能為空字串）
    timestamp: string;        // "HH:MM"
    raw: string;              // 時間後的完整原始字串
    author: string;           // 發話者名稱
    content: string;          // 訊息內容
    authorConfident: boolean; // false = 未命中已知作者，建議批次送 LLM 補正
    type: "message" | "sticker" | "join" | "leave" | "recall" | "system";
}

// 日期標題列，例：2022.03.16 星期三 或 2024/01/15(月)
const DATE_HEADER_RE = /^(\d{4}[./]\d{2}[./]\d{2})/

// 訊息行：HH:MM（tab 或空白）剩餘內容
const LINE_RE = /^(\d{1,2}:\d{2})[\t ](.+)$/;

const SYSTEM_SUFFIXES: Array<{ suffix: string; type: IChatMessage["type"] }> = [
    { suffix: "加入聊天",   type: "join"   },
    { suffix: "退出聊天",   type: "leave"  },
    { suffix: "已收回訊息", type: "recall" },
];

// 作者名稱最多幾個 token（空白分隔）
const MAX_AUTHOR_TOKENS = 4;

/**
 * Pass 1：統計每個 raw 的 1～MAX_AUTHOR_TOKENS token 前綴出現次數。
 * 高頻前綴即為已知作者名稱（訊息內容不重複，人名會）。
 *
 * @param raws      所有訊息行的 raw 字串
 * @param minCount  最少出現幾次才列入已知作者（預設 2）
 */
function collectKnownAuthors(raws: string[], minCount = 2): Set<string> {
    const freq = new Map<string, number>();

    for (const raw of raws) {
        const tokens = raw.split(" ");
        for (let i = 1; i <= Math.min(MAX_AUTHOR_TOKENS, tokens.length); i++) {
            // 只計算「前綴後方還有內容」的情況
            // 若 i === tokens.length 代表整個 raw 都是候選詞，不可能是作者
            if (i < tokens.length) {
                const candidate = tokens.slice(0, i).join(" ");
                freq.set(candidate, (freq.get(candidate) ?? 0) + 1);
            }
        }
    }

    const authors = new Set<string>();
    for (const [candidate, count] of freq) {
        if (count >= minCount) authors.add(candidate);
    }
    return authors;
}

/**
 * 用已知作者名單對 raw 做 startsWith 最長前綴比對。
 * 有命中回傳 confident: true，否則退回第一個 token 並標記 confident: false。
 */
function matchAuthor(
    raw: string,
    knownAuthors: Set<string>,
): { author: string; content: string; confident: boolean } {
    // 由長到短試，確保優先命中多字節名稱（如 "Evan You"）
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

    // Fallback：切第一個 token
    const spaceIdx = raw.indexOf(" ");
    return {
        author:    spaceIdx === -1 ? raw : raw.slice(0, spaceIdx),
        content:   spaceIdx === -1 ? "" : raw.slice(spaceIdx + 1).trim(),
        confident: false,
    };
}

function classifyLine(
    timestamp: string,
    raw: string,
    date: string,
    knownAuthors: Set<string>,
): IChatMessage {
    // 系統事件優先判斷：直接從尾端剪去 suffix 取得 author
    // 適用無空格格式如「Unknown已收回訊息」、「Alweis加入聊天」
    for (const { suffix, type } of SYSTEM_SUFFIXES) {
        if (raw.endsWith(suffix)) {
            const author = raw.slice(0, raw.length - suffix.length);
            const confident = knownAuthors.has(author);
            return { date, timestamp, raw, author, content: suffix, authorConfident: confident, type };
        }
    }

    const { author, content, confident } = matchAuthor(raw, knownAuthors);

    if (content === "貼圖") {
        return { date, timestamp, raw, author, content, authorConfident: confident, type: "sticker" };
    }

    return { date, timestamp, raw, author, content, authorConfident: confident, type: "message" };
}

/**
 * 讀取並解析聊天紀錄 txt 檔案。兩階段處理：
 *   1. 掃描全文建立已知作者名單
 *   2. 用 startsWith 比對，僅對未命中行標記 authorConfident=false
 *
 * @param filePath  txt 檔案路徑
 * @returns         解析後的訊息陣列
 */
export function loadChatHistory(filePath: string): IChatMessage[] {
    const text  = readFileSync(filePath, "utf-8");
    const lines = text.split(/\r?\n/);

    // ── Pass 1：收集所有 raw entry ──────────────────────────────────────
    type RawEntry = { timestamp: string; raw: string; date: string };
    const entries: RawEntry[] = [];
    let currentDate = "";

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line) continue;

        const dateMatch = DATE_HEADER_RE.exec(line);
        if (dateMatch) { currentDate = dateMatch[1]; continue; }

        const lineMatch = LINE_RE.exec(line);
        if (lineMatch) {
            entries.push({ timestamp: lineMatch[1], raw: lineMatch[2], date: currentDate });
        }
    }

    // ── Pass 2：推導已知作者名單 ────────────────────────────────────────
    const knownAuthors = collectKnownAuthors(entries.map(e => e.raw));

    // ── Pass 3：分類並切割 ──────────────────────────────────────────────
    return entries.map(({ timestamp, raw, date }) =>
        classifyLine(timestamp, raw, date, knownAuthors),
    );
}

/**
 * 從解析結果中篩出 authorConfident=false 的行，供批次送 LLM 補正。
 */
export function getUnconfidentMessages(messages: IChatMessage[]): IChatMessage[] {
    return messages.filter(m => !m.authorConfident);
}