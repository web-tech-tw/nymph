import { tool } from "ai";
import { z } from "zod";
import mongoose from "mongoose";
import { isDatabaseConnected } from "../../databases/connection";

export interface KnowledgeDocsConfig {
    defaultCollection?: string;
    defaultIndex?: string;
    defaultTextField?: string;
}

export function toolKnowledgeDocs(config?: KnowledgeDocsConfig) {
    const defaultCollection = config?.defaultCollection || "knowledge";
    const defaultIndex = config?.defaultIndex || "default";
    const defaultTextField = config?.defaultTextField || "text";

    return tool({
        description:
            "Perform lexical full-text keyword search on MongoDB knowledge documents. " +
            "Returns top-k most relevant documents with relevance scores.",
        inputSchema: z.object({
            input: z.string().describe("search keywords or query string"),
            dbName: z.string().optional().describe("database name override"),
            collectionName: z.string().default(defaultCollection).describe("collection name"),
            indexName: z.string().default(defaultIndex).describe("full-text search index name"),
            textField: z.string().default(defaultTextField).describe("field name of text content"),
            k: z.number().int().min(1).max(50).default(5).describe("maximum number of documents to return"),
        }),
        execute: async ({
            input,
            dbName,
            collectionName,
            indexName,
            textField,
            k,
        }) => {
            const query = input?.trim();
            if (!query) {
                return "Error: Please provide search keywords.";
            }

            if (!isDatabaseConnected() || !mongoose.connection.db) {
                return "Error: MongoDB connection is not ready.";
            }

            try {
                const db = dbName ? mongoose.connection.getClient().db(dbName) : mongoose.connection.db;
                const collection = db.collection(collectionName);
                const limit = Math.min(Math.max(k, 1), 50);

                let results: Record<string, unknown>[] = [];

                // 1. Try Atlas Search ($search lexical text query)
                try {
                    const atlasPipeline: Record<string, unknown>[] = [
                        {
                            $search: {
                                index: indexName,
                                text: {
                                    query,
                                    path: textField === "*" ? { wildcard: "*" } : textField,
                                },
                            },
                        },
                        {
                            $limit: limit,
                        },
                        {
                            $project: {
                                _id: 1,
                                [textField]: 1,
                                score: { $meta: "searchScore" },
                                metadata: 1,
                            },
                        },
                    ];
                    results = await collection.aggregate(atlasPipeline).toArray();
                } catch {
                    // 2. Fallback to standard MongoDB $text full-text search
                    try {
                        results = await collection
                            .find(
                                { $text: { $search: query } },
                                { projection: { score: { $meta: "textScore" }, [textField]: 1, metadata: 1 } },
                            )
                            .sort({ score: { $meta: "textScore" } })
                            .limit(limit)
                            .toArray();
                    } catch {
                        // 3. Fallback to regex search on textField
                        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
                        results = await collection
                            .find({ [textField]: regex })
                            .limit(limit)
                            .toArray();
                    }
                }

                if (!results.length) {
                    return "No matching documents found.";
                }

                return results
                    .map((doc, i) => {
                        const text = (doc[textField] as string) ?? JSON.stringify(doc);
                        const score = typeof doc.score === "number" ? doc.score.toFixed(4) : "N/A";
                        const meta = JSON.stringify(doc.metadata ?? {});
                        return `${i + 1}. Score=${score}\nText: ${text}\nMetadata: ${meta}`;
                    })
                    .join("\n\n");
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error("[KnowledgeDocs] Lexical search failed:", error);
                return `Error: Lexical search failed - ${msg}`;
            }
        },
    });
}
