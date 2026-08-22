import { tool } from "ai";
import { z } from "zod";
import { isDatabaseConnected } from "../../databases/connection";
import { KnowledgeModel } from "../../databases/models/knowledge";

export interface QueryKnowledgeParams {
    query: string;
    category?: string;
    limit?: number;
}

export async function queryKnowledgeDocuments({
    query,
    category,
    limit = 5,
}: QueryKnowledgeParams): Promise<string> {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
        return "Error: Please provide search keywords.";
    }

    if (!isDatabaseConnected()) {
        return "Error: Database connection is not ready.";
    }

    const maxLimit = Math.min(Math.max(limit, 1), 20);

    try {
        // 1. Primary: Full-text search with relevance scoring
        const textFilter: Record<string, unknown> = {
            $text: { $search: trimmedQuery },
        };
        if (category) {
            textFilter["metadata.category"] = category;
        }

        let docs = await KnowledgeModel.find(
            textFilter,
            { score: { $meta: "textScore" }, text: 1, metadata: 1 },
        )
            .sort({ score: { $meta: "textScore" } })
            .limit(maxLimit)
            .lean();

        // 2. Fallback: Regex search across text, topic, and tags
        if (!docs.length) {
            const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escaped, "i");
            const regexFilter: Record<string, unknown> = {
                $or: [
                    { text: regex },
                    { "metadata.topic": regex },
                    { "metadata.tags": { $in: [regex] } },
                ],
            };
            if (category) {
                regexFilter["metadata.category"] = category;
            }

            docs = await KnowledgeModel.find(regexFilter)
                .limit(maxLimit)
                .lean();
        }

        if (!docs.length) {
            return `<knowledge_documents count="0" query="${trimmedQuery}" />`;
        }

        const docXml = docs
            .map((doc, index) => {
                const rawDoc = doc as Record<string, unknown>;
                const scoreAttr = typeof rawDoc.score === "number" ? ` score="${rawDoc.score.toFixed(2)}"` : "";
                const topic = doc.metadata?.topic ? ` topic="${doc.metadata.topic}"` : "";
                const categoryAttr = doc.metadata?.category ? ` category="${doc.metadata.category}"` : "";
                return `  <document index="${index + 1}"${topic}${categoryAttr}${scoreAttr}>\n${doc.text}\n  </document>`;
            })
            .join("\n");

        return `<knowledge_documents count="${docs.length}" query="${trimmedQuery}">\n${docXml}\n</knowledge_documents>`;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[KnowledgeDocs] Search failed:", error);
        return `Error searching knowledge base: ${msg}`;
    }
}

export function toolKnowledgeDocs() {
    return tool({
        description:
            "Search the engineering knowledge base for historical troubleshooting solutions, architecture decisions, code snippets, and technical discussions.",
        inputSchema: z.object({
            query: z
                .string()
                .describe(
                    "Search keywords or technical questions to look up in the knowledge base (e.g. 'vue3 pinia', 'docker getting started', 'element-ui gyp').",
                ),
            category: z
                .string()
                .optional()
                .describe(
                    "Optional technical category filter (e.g. 'Frontend', 'Backend', 'DevOps', 'Tools & Best Practices', 'Security & Auth', 'AI & Machine Learning').",
                ),
            limit: z
                .number()
                .int()
                .min(1)
                .max(20)
                .default(5)
                .describe("Maximum number of knowledge slices to return (default: 5)."),
        }),
        execute: async ({ query, category, limit = 5 }) => {
            return queryKnowledgeDocuments({ query, category, limit });
        },
    });
}
