import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import { TavilyClient } from "tavily";

/**
 * Extract description from content.
 * @param content - The content to extract from.
 * @param maxLen - Maximum length of the description.
 * @returns The extracted description.
 */
function extractContentDescription(
    content: string,
    maxLen: number = 500,
): string {
    if (content.length <= maxLen) {
        return content;
    }

    const truncated = content.slice(0, maxLen);
    const lastPeriod = truncated.lastIndexOf("。");
    const lastExclaim = truncated.lastIndexOf("！");
    const lastQuestion = truncated.lastIndexOf("？");
    const lastDot = truncated.lastIndexOf(".");

    const cutPoint = Math.max(lastPeriod, lastExclaim, lastQuestion, lastDot);
    if (cutPoint > maxLen * 0.5) {
        return truncated.slice(0, cutPoint + 1);
    }

    return truncated + "...";
}

const description = [
    "Search the web for current information, news, facts, and real-world knowledge.",
    "Good for: recent events, people, companies, products, or any topic requiring up-to-date information.",
    "Returns accurate results with source citations.",
].join(" ");

/**
 * Create a Tavily web search tool if the API key is present.
 * @param apiKey - The Tavily API key.
 * @returns The configured tool, or null if no API key is provided.
 */
export function createTavilySearch(apiKey?: string): DynamicStructuredTool | null {
    if (!apiKey) {
        return null;
    }

    const client = new TavilyClient({ apiKey });

    return new DynamicStructuredTool({
        name: "tavily_search",
        description,
        schema: z.object({
            query: z
                .string()
                .min(1, "Query is required.")
                .describe("The search query"),
            depth: z
                .preprocess(
                    (val) => {
                        if (val === "basic" || val === "advanced") {
                            return val;
                        }
                        return "basic";
                    },
                    z.enum(["basic", "advanced"]),
                )
                .nullable()
                .default("basic")
                .describe("Search depth: basic (faster) or advanced (comprehensive)"),
            includeAnswer: z.boolean().nullable().default(true),
            maxResults: z.number().int().min(1).max(10).nullable().default(5),
        }),
        func: async ({ query, depth, includeAnswer, maxResults }: {
            query: string;
            depth: "basic" | "advanced" | null;
            includeAnswer: boolean | null;
            maxResults: number | null;
        }) => {
            const response = await client.search({
                query,
                search_depth: depth ?? "basic",
                include_answer: includeAnswer ?? true,
                max_results: maxResults ?? 5,
            });

            return JSON.stringify({
                answer: response.answer,
                sources: response.results
                    .slice(0, maxResults ?? 5)
                    .map((result) => ({
                        title: result.title,
                        url: result.url,
                        content: extractContentDescription(result.content || "", 300),
                    })),
            });
        },
    });
}
