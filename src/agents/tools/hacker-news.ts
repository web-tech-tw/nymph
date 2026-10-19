import { tool } from "ai";
import { z } from "zod";

const FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";
const ALGOLIA_SEARCH_URL = "https://hn.algolia.com/api/v1/search";
const ALGOLIA_SEARCH_BY_DATE_URL = "https://hn.algolia.com/api/v1/search_by_date";

const CATEGORY_ENDPOINTS = {
    top: "topstories",
    new: "newstories",
    best: "beststories",
    ask: "askstories",
    show: "showstories",
    job: "jobstories",
} as const;

export type HackerNewsCategory = keyof typeof CATEGORY_ENDPOINTS;

export type HackerNewsSort = "relevance" | "date";

export interface QueryHackerNewsParams {
    query?: string;
    category?: HackerNewsCategory;
    storyId?: number;
    limit?: number;
    sort?: HackerNewsSort;
    days?: number;
}

interface HnItem {
    id: number;
    type?: string;
    title?: string;
    url?: string;
    text?: string;
    score?: number;
    by?: string;
    time?: number;
    descendants?: number;
    kids?: number[];
    deleted?: boolean;
    dead?: boolean;
}

interface AlgoliaHit {
    objectID: string;
    title?: string;
    url?: string;
    author?: string;
    points?: number;
    num_comments?: number;
    created_at_i?: number;
    story_text?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_LIMIT = 20;
const MAX_COMMENT_LENGTH = 600;
const MAX_COMMENTS = 10;

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function stripHtml(text: string): string {
    return text
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatTime(unixSeconds?: number): string {
    if (!unixSeconds) return "";
    return new Date(unixSeconds * 1000).toISOString();
}

function clampLimit(limit?: number): number {
    return Math.min(Math.max(limit ?? 10, 1), MAX_LIMIT);
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Request to ${url} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
}

function buildStoryXml(
    item: HnItem,
    index: number,
): string {
    const scoreAttr = typeof item.score === "number" ? ` score="${item.score}"` : "";
    const commentsAttr =
        typeof item.descendants === "number" ? ` comments="${item.descendants}"` : "";
    const authorAttr = item.by ? ` author="${escapeXml(item.by)}"` : "";
    const timeAttr = item.time ? ` time="${formatTime(item.time)}"` : "";
    const url = item.url || (item.id ? `https://news.ycombinator.com/item?id=${item.id}` : "");
    const lines = [
        `  <story index="${index}" id="${item.id}"${scoreAttr}${commentsAttr}${authorAttr}${timeAttr}>`,
        `    <title>${escapeXml(item.title ?? "")}</title>`,
        `    <url>${escapeXml(url)}</url>`,
    ];
    if (item.text) {
        lines.push(`    <text>${escapeXml(stripHtml(item.text).slice(0, MAX_COMMENT_LENGTH))}</text>`);
    }
    lines.push("  </story>");
    return lines.join("\n");
}

async function fetchStoryListings(
    category: HackerNewsCategory,
    limit: number,
): Promise<string> {
    const ids = await fetchJson<number[]>(
        `${FIREBASE_BASE}/${CATEGORY_ENDPOINTS[category]}.json`,
    );
    const targetIds = (ids || []).slice(0, limit);
    if (!targetIds.length) {
        return `<hacker_news category="${category}" count="0" />`;
    }

    const items = await Promise.all(
        targetIds.map((id) =>
            fetchJson<HnItem | null>(`${FIREBASE_BASE}/item/${id}.json`).catch(() => null),
        ),
    );
    const stories = items.filter((item): item is HnItem => Boolean(item));

    if (!stories.length) {
        return `<hacker_news category="${category}" count="0" />`;
    }

    const storyXml = stories
        .map((item, index) => buildStoryXml(item, index + 1))
        .join("\n");
    return `<hacker_news category="${category}" count="${stories.length}">\n${storyXml}\n</hacker_news>`;
}

async function searchStories(
    query: string,
    limit: number,
    sort: HackerNewsSort = "relevance",
    days?: number,
): Promise<string> {
    const trimmed = query.trim();
    if (!trimmed) {
        return "Error: Please provide search keywords.";
    }

    const params = new URLSearchParams({
        tags: "story",
        hitsPerPage: String(limit),
        query: trimmed,
    });
    if (days && days > 0) {
        const minCreated = Math.floor(Date.now() / 1000) - days * 86_400;
        params.set("numericFilters", `created_at_i>${minCreated}`);
    }

    const endpoint =
        sort === "date" ? ALGOLIA_SEARCH_BY_DATE_URL : ALGOLIA_SEARCH_URL;
    const url = `${endpoint}?${params.toString()}`;
    const data = await fetchJson<{ hits?: AlgoliaHit[] }>(url);
    const hits = data.hits || [];

    if (!hits.length) {
        const daysAttr = days && days > 0 ? ` days="${days}"` : "";
        return `<hacker_news search="${escapeXml(trimmed)}"${daysAttr} count="0" />`;
    }

    const sortAttr = ` sort="${sort}"`;
    const daysAttr = days && days > 0 ? ` days="${days}"` : "";
    const storyXml = hits
        .map((hit, index) => {
            const item: HnItem = {
                id: Number(hit.objectID),
                title: hit.title ?? "",
                url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
                score: hit.points,
                by: hit.author,
                time: hit.created_at_i,
                descendants: hit.num_comments,
                text: hit.story_text,
            };
            return buildStoryXml(item, index + 1);
        })
        .join("\n");

    return `<hacker_news search="${escapeXml(trimmed)}"${sortAttr}${daysAttr} count="${hits.length}">\n${storyXml}\n</hacker_news>`;
}

async function fetchStoryDetail(
    storyId: number,
    commentLimit: number,
): Promise<string> {
    const item = await fetchJson<HnItem | null>(
        `${FIREBASE_BASE}/item/${storyId}.json`,
    );
    if (!item || item.deleted || item.dead) {
        return `Error: Hacker News story ${storyId} was not found.`;
    }

    const lines: string[] = ["<hacker_news_story>"];
    lines.push(buildStoryXml(item, 1).replace(/^ {2}/, ""));

    const commentIds = (item.kids || []).slice(0, Math.min(commentLimit, MAX_COMMENTS));
    if (commentIds.length) {
        lines.push(`  <comments count="${commentIds.length}">`);
        const comments = await Promise.all(
            commentIds.map((id) =>
                fetchJson<HnItem | null>(`${FIREBASE_BASE}/item/${id}.json`).catch(() => null),
            ),
        );
        comments.forEach((comment, index) => {
            if (!comment || comment.deleted || comment.dead) return;
            const authorAttr = comment.by ? ` author="${escapeXml(comment.by)}"` : "";
            const text = escapeXml(stripHtml(comment.text ?? "").slice(0, MAX_COMMENT_LENGTH));
            lines.push(
                `    <comment index="${index + 1}"${authorAttr}>${text}</comment>`,
            );
        });
        lines.push("  </comments>");
    }

    lines.push("</hacker_news_story>");
    return lines.join("\n");
}

/**
 * Queries Hacker News via the official Firebase API and the Algolia HN Search API.
 * Precedence: storyId (single story with comments) > query (keyword search) > category listing.
 */
export async function queryHackerNews({
    query,
    category = "top",
    storyId,
    limit,
    sort,
    days,
}: QueryHackerNewsParams): Promise<string> {
    const maxLimit = clampLimit(limit);

    try {
        if (storyId) {
            return await fetchStoryDetail(storyId, maxLimit);
        }
        if (query !== undefined && !query.trim()) {
            return "Error: Please provide search keywords.";
        }
        if (query) {
            return await searchStories(query, maxLimit, sort, days);
        }
        return await fetchStoryListings(category, maxLimit);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[HackerNews] Request failed:", error);
        return `Error fetching Hacker News: ${msg}`;
    }
}

export type HackerNewsFetcher = (params: QueryHackerNewsParams) => Promise<string>;

export function toolHackerNews(customFetcher?: HackerNewsFetcher) {
    return tool({
        description:
            "Fetch Hacker News stories: list top/new/best/ask/show/job stories, search stories by keyword, or get a single story with its comments by ID.",
        inputSchema: z.object({
            query: z
                .string()
                .optional()
                .describe(
                    "Keyword to search Hacker News stories (e.g. 'rust compiler', 'webassembly'). Takes precedence over category.",
                ),
            sort: z
                .enum(["relevance", "date"])
                .optional()
                .default("relevance")
                .describe(
                    "Search result ordering for keyword search: 'relevance' (best match, default) or 'date' (newest first). Use 'date' whenever the user asks for the latest, newest, or recent news on a topic.",
                ),
            days: z
                .number()
                .int()
                .min(1)
                .max(365)
                .optional()
                .describe(
                    "Optional: only return keyword-search results from the last N days (e.g. 7 for the past week). Combine with sort='date' for recent news.",
                ),
            category: z
                .enum(["top", "new", "best", "ask", "show", "job"])
                .optional()
                .default("top")
                .describe(
                    "Story listing category: 'top' (front page), 'new' (newest), 'best' (all-time best), 'ask' (Ask HN), 'show' (Show HN), 'job' (jobs). Default: 'top'. Ignored when query or storyId is provided.",
                ),
            storyId: z
                .number()
                .int()
                .optional()
                .describe(
                    "Fetch a single Hacker News story with its top-level comments by item ID (takes precedence over query and category).",
                ),
            limit: z
                .number()
                .int()
                .min(1)
                .max(MAX_LIMIT)
                .optional()
                .default(10)
                .describe(
                    "Maximum number of stories (or comments when fetching a single story) to return (default: 10, max: 20).",
                ),
        }),
        execute: async ({ query, category, storyId, limit, sort, days }) => {
            if (customFetcher) {
                return customFetcher({ query, category, storyId, limit, sort, days });
            }
            return queryHackerNews({ query, category, storyId, limit, sort, days });
        },
    });
}
