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
