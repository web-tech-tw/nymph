/**
 * arxiv URL detection and trigger-tag helpers.
 * The tag is a deterministic, system-injected signal that tells the agent
 * to read the referenced papers via the firecrawl MCP tools.
 */

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;
const ARXIV_HOST = "arxiv.org";
const ARXIV_HOST_SUFFIX = ".arxiv.org";
const MAX_ARXIV_URLS = 3;

/**
 * Returns true only for arxiv.org hosts (e.g. arxiv.org, export.arxiv.org).
 */
export function isArxivUrl(url: string): boolean {
    try {
        const { hostname } = new URL(url);
        return hostname === ARXIV_HOST || hostname.endsWith(ARXIV_HOST_SUFFIX);
    } catch {
        return false;
    }
}

/**
 * Extracts de-duplicated arxiv URLs from a message, in order of appearance.
 */
export function extractArxivUrls(content: string): string[] {
    if (!content) return [];
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const match of content.match(URL_REGEX) || []) {
        const url = match.replace(/[.,;:!?)}\]]+$/, "");
        if (!seen.has(url) && isArxivUrl(url)) {
            seen.add(url);
            urls.push(url);
        }
    }
    return urls.slice(0, MAX_ARXIV_URLS);
}

/**
 * Formats the system-injected trigger tag listing detected arxiv URLs.
 */
export function formatArxivPaperTag(urls: string[]): string {
    if (!urls.length) return "";
    return `<arxiv_paper urls="${urls.join(" ")}" />`;
}

/**
 * Neutralizes user-typed arxiv_paper tags so only system-injected ones are trusted.
 */
export function sanitizeArxivPaperTags(content: string): string {
    return content
        .replace(/<\s*\/?\s*arxiv_paper[^>]*>/gi, (match) =>
            match.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
        );
}

/**
 * Structured card payload the agent must emit when an arxiv_paper tag triggers.
 * Discord renders it as an embed card; other platforms render it as plain text.
 */
export interface ArxivReplyCard {
    title: string;
    url: string;
    summary: string;
    comment: string;
}

const CARD_BLOCK_REGEX = /<arxiv_reply>([\s\S]*?)<\/arxiv_reply>/i;

function readCardField(block: string, name: string): string {
    const match = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
    const value = match?.[1];
    return value ? value.trim() : "";
}

/**
 * Parses the <arxiv_reply> block from an agent reply.
 * Returns null when no valid card block is present.
 */
export function parseArxivReplyCard(text: string): ArxivReplyCard | null {
    if (!text) return null;
    const block = text.match(CARD_BLOCK_REGEX)?.[1];
    if (!block) return null;

    const card: ArxivReplyCard = {
        title: readCardField(block, "title"),
        url: readCardField(block, "url"),
        summary: readCardField(block, "summary"),
        comment: readCardField(block, "comment"),
    };
    if (!card.title || !card.summary) return null;
    return card;
}

/**
 * Renders a card payload as clean plain text for non-embed platforms.
 */
export function renderArxivReplyText(card: ArxivReplyCard): string {
    const lines = [`論文：${card.title}`];
    if (card.url) lines.push(card.url);
    lines.push("", `簡介：${card.summary}`);
    if (card.comment) lines.push(`心得：${card.comment}`);
    return lines.join("\n");
}

/**
 * Replaces a card block with its plain-text form; returns non-card text unchanged.
 */
export function flattenArxivReply(text: string): string {
    const card = parseArxivReplyCard(text);
    return card ? renderArxivReplyText(card) : text;
}
