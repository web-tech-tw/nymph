import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { toolHackerNews, queryHackerNews, type QueryHackerNewsParams } from "./hacker-news";

const FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";

type FetchHandler = (url: string) => unknown;

let fetchHandler: FetchHandler | null = null;
const originalFetch = globalThis.fetch;

function mockFetch(handler: FetchHandler) {
    fetchHandler = handler;
}

beforeEach(() => {
    globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        if (!fetchHandler) throw new Error(`Unexpected fetch: ${url}`);
        return new Response(JSON.stringify(fetchHandler(url)), {
            status: 200,
            headers: { "content-type": "application/json" },
        });
    }) as unknown as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchHandler = null;
});

const storyItem = (id: number, overrides: Record<string, unknown> = {}) => ({
    id,
    type: "story",
    title: `Story ${id}`,
    url: `https://example.com/${id}`,
    score: 100 + id,
    by: "alice",
    time: 1700000000,
    descendants: 42,
    ...overrides,
});

describe("hackerNews tool", () => {
    it("delegates to the custom fetcher with the given params", async () => {
        const calls: QueryHackerNewsParams[] = [];
        const tool = toolHackerNews(async (params) => {
            calls.push(params);
            return "custom result";
        });

        const result = await (
            tool as unknown as {
                execute: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>;
            }
        ).execute({ query: "bun runtime", category: "new", storyId: undefined, limit: 5 }, {
            toolCallId: "call-1",
        });

        expect(result).toBe("custom result");
        expect(calls[0]).toEqual({
            query: "bun runtime",
            category: "new",
            storyId: undefined,
            limit: 5,
        });
    });

    it("has a description and input schema", () => {
        const tool = toolHackerNews();
        expect(tool.description).toContain("Hacker News");
    });
});

describe("queryHackerNews listings", () => {
    it("fetches top stories by category", async () => {
        mockFetch((url) => {
            if (url === `${FIREBASE_BASE}/topstories.json`) return [1, 2];
            if (url === `${FIREBASE_BASE}/item/1.json`) return storyItem(1);
            if (url === `${FIREBASE_BASE}/item/2.json`) return storyItem(2);
            throw new Error(`Unexpected url: ${url}`);
        });

        const result = await queryHackerNews({ category: "top", limit: 2 });

        expect(result).toContain("<hacker_news category=\"top\" count=\"2\">");
        expect(result).toContain("<story index=\"1\" id=\"1\" score=\"101\" comments=\"42\"");
        expect(result).toContain("<title>Story 1</title>");
        expect(result).toContain("<url>https://example.com/1</url>");
    });

    it("falls back to the HN discussion URL when a story has no url", async () => {
        mockFetch((url) => {
            if (url === `${FIREBASE_BASE}/askstories.json`) return [7];
            if (url === `${FIREBASE_BASE}/item/7.json`)
                return storyItem(7, { url: undefined, title: "Ask HN: anything?" });
            throw new Error(`Unexpected url: ${url}`);
        });

        const result = await queryHackerNews({ category: "ask", limit: 1 });

        expect(result).toContain("<url>https://news.ycombinator.com/item?id=7</url>");
    });

    it("skips failed item fetches without failing the whole listing", async () => {
        mockFetch((url) => {
            if (url === `${FIREBASE_BASE}/newstories.json`) return [1, 2];
            if (url === `${FIREBASE_BASE}/item/1.json`) return storyItem(1);
            if (url === `${FIREBASE_BASE}/item/2.json`) return null;
            throw new Error(`Unexpected url: ${url}`);
        });

        const result = await queryHackerNews({ category: "new", limit: 2 });

        expect(result).toContain("count=\"1\"");
        expect(result).toContain("id=\"1\"");
    });
});

describe("queryHackerNews search", () => {
    it("searches stories via the Algolia API", async () => {
        mockFetch((url) => {
            expect(url).toContain("https://hn.algolia.com/api/v1/search?");
            expect(url).toContain("tags=story");
            expect(url).toContain("hitsPerPage=3");
            expect(decodeURIComponent(url)).toContain("query=rust compiler");
            return {
                hits: [
                    {
                        objectID: "11",
                        title: "Rust <compiler> rewrite",
                        url: "https://example.com/rust",
                        author: "bob",
                        points: 500,
                        num_comments: 12,
                        created_at_i: 1699999999,
                    },
                ],
            };
        });

        const result = await queryHackerNews({ query: "rust compiler", limit: 3 });

        expect(result).toContain("<hacker_news search=\"rust compiler\" count=\"1\">");
        expect(result).toContain("<title>Rust &lt;compiler&gt; rewrite</title>");
        expect(result).toContain("score=\"500\" comments=\"12\"");
        expect(result).toContain("author=\"bob\"");
    });

    it("returns an empty result when there are no hits", async () => {
        mockFetch(() => ({ hits: [] }));

        const result = await queryHackerNews({ query: "nothing-matches", limit: 5 });

        expect(result).toContain("count=\"0\"");
    });

    it("rejects an empty query", async () => {
        const result = await queryHackerNews({ query: "   ", limit: 5 });

        expect(result).toBe("Error: Please provide search keywords.");
    });
});

describe("queryHackerNews story detail", () => {
    it("fetches a single story with top-level comments", async () => {
        mockFetch((url) => {
            if (url === `${FIREBASE_BASE}/item/99.json`)
                return storyItem(99, {
                    title: "Show HN: Nymph",
                    kids: [201, 202],
                    text: "<b>Hello</b> world",
                });
            if (url === `${FIREBASE_BASE}/item/201.json`)
                return { id: 201, by: "carol", text: "Nice <i>project</i> &amp; useful" };
            if (url === `${FIREBASE_BASE}/item/202.json`) return null;
            throw new Error(`Unexpected url: ${url}`);
        });

        const result = await queryHackerNews({ storyId: 99, limit: 10 });

        expect(result).toContain("<hacker_news_story>");
        expect(result).toContain("<title>Show HN: Nymph</title>");
        expect(result).toContain("<text>Hello world</text>");
        expect(result).toContain("  <comments count=\"2\">");
        expect(result).toContain("<comment index=\"1\" author=\"carol\">Nice project &amp; useful</comment>");
        expect(result).toContain("</hacker_news_story>");
    });

    it("reports missing stories", async () => {
        mockFetch((url) => {
            expect(url).toBe(`${FIREBASE_BASE}/item/404.json`);
            return null;
        });

        const result = await queryHackerNews({ storyId: 404 });

        expect(result).toContain("was not found");
    });
});

describe("queryHackerNews error handling", () => {
    it("returns an error string when the request fails", async () => {
        globalThis.fetch = (async () => {
            throw new Error("network down");
        }) as unknown as typeof fetch;

        const result = await queryHackerNews({ category: "top" });

        expect(result).toContain("Error fetching Hacker News: network down");
    });

    it("returns an error string on non-2xx responses", async () => {
        globalThis.fetch = (async () =>
            new Response("rate limited", { status: 429 })) as unknown as typeof fetch;

        const result = await queryHackerNews({ category: "top" });

        expect(result).toContain("Error fetching Hacker News");
        expect(result).toContain("429");
    });
});
