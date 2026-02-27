import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { useDatabase } from "../clients/database.ts";

function formatSearchResults(results: any[], startIndex = 0): string {
    return results
        .map(([doc, score]: any, i: number) => {
            const text = doc.pageContent || doc.text || "";
            const metadata = JSON.stringify(doc.metadata ?? {});
            const scoreStr = Number(score).toFixed(4);
            return [
                `${startIndex + i + 1}. Score=${scoreStr}`,
                `Text: ${text}`,
                `Metadata: ${metadata}`,
            ].join("\n");
        })
        .join("\n\n");
}

function createEmbeddings(apiKey: string, options: any = {}) {
    return new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: options.model ?? "text-embedding-004",
        taskType: options.taskType ?? "RETRIEVAL_DOCUMENT",
        ...options,
    });
}

export function createKnowledgeDocs(opts: any = {}) {
    const { googleApiKey, googleOptions = {} } = opts;

    if (!googleApiKey || typeof googleApiKey !== "string") {
        throw new Error(
            "googleApiKey is required. " +
                "Usage: createKnowledgeDocs({googleApiKey: 'key'})",
        );
    }

    return new DynamicStructuredTool({
        name: "KnowledgeDocs",
        description:
            "Perform vector similarity search on MongoDB Atlas " +
            "collection. Returns top-k most relevant documents " +
            "with similarity scores.",
        schema: z.object({
            input: z.string().describe("search query"),
            dbName: z.string().optional(),
            collectionName: z
                .string()
                .describe("collection name")
                .default("knowledge"),
            indexName: z
                .string()
                .describe("Atlas vector search index name")
                .default("default"),
            embeddingField: z
                .string()
                .describe("field containing vector embedding")
                .default("embedding"),
            textField: z
                .string()
                .describe("field containing text content")
                .default("text"),
            k: z
                .number()
                .int()
                .min(1)
                .max(50)
                .describe("number of results to return")
                .default(5),
            preFilter: z
                .record(z.any())
                .optional()
                .describe("MongoDB query for pre-filtering"),
        }),

        func: async (params: any) => {
            const {
                input,
                dbName,
                collectionName = "knowledge",
                indexName = "default",
                embeddingField = "embedding",
                textField = "text",
                k = 5,
                preFilter,
            } = params || {};

            const query = input?.trim();
            if (!query) {
                return "Error: Please provide a search query.";
            }

            const db = useDatabase();
            if (!db?.connection?.db) {
                return (
                    "Error: MongoDB connection not ready. " +
                    "Ensure database is connected."
                );
            }

            const dbRef = db.connection.db.db(dbName || db.connection.name);
            const collection = dbRef.collection(collectionName);

            const embeddings = createEmbeddings(googleApiKey, googleOptions);

            const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
                collection,
                indexName,
                textKey: textField,
                embeddingKey: embeddingField,
            });

            try {
                const results =
                    await vectorStore.similaritySearchWithScore(
                        query,
                        Math.min(k, 50),
                        preFilter,
                    );

                if (!results?.length) {
                    return "No matching documents found.";
                }

                return formatSearchResults(results);
            } catch (error: any) {
                console.error("Vector search error:", error);
                return `Error: Vector search failed - ${error.message}`;
            }
        },
    });
}
