import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { getDatabase } from "../../database/connection.ts";

interface KnowledgeDocsConfig {
    googleApiKey: string;
    googleOptions?: Record<string, unknown>;
}

interface SearchDocument {
    pageContent?: string;
    text?: string;
    metadata?: Record<string, unknown>;
}

function createEmbeddings(apiKey: string, options: Record<string, unknown> = {}): GoogleGenerativeAIEmbeddings {
    const model = (options.model as string) ?? "text-embedding-004";
    const taskType = ((options.taskType as string) ?? "RETRIEVAL_DOCUMENT") as TaskType;
    return new GoogleGenerativeAIEmbeddings({ apiKey, model, taskType, ...options });
}

function formatResults(results: Array<[SearchDocument, number]>): string {
    return results
        .map(([doc, score], i) => {
            const text = doc.pageContent ?? doc.text ?? "";
            const meta = JSON.stringify(doc.metadata ?? {});
            return `${i + 1}. Score=${score.toFixed(4)}\nText: ${text}\nMetadata: ${meta}`;
        })
        .join("\n\n");
}

export function createKnowledgeDocs(config: KnowledgeDocsConfig): DynamicStructuredTool {
    const { googleApiKey, googleOptions = {} } = config;

    if (!googleApiKey) {
        throw new Error("googleApiKey is required for KnowledgeDocs tool");
    }

    return new DynamicStructuredTool({
        name: "KnowledgeDocs",
        description:
            "Perform vector similarity search on MongoDB Atlas. " +
            "Returns top-k most relevant documents with similarity scores.",
        schema: z.object({
            input: z.string().describe("search query"),
            dbName: z.string().optional(),
            collectionName: z.string().default("knowledge"),
            indexName: z.string().default("default"),
            embeddingField: z.string().default("embedding"),
            textField: z.string().default("text"),
            k: z.number().int().min(1).max(50).default(5),
            preFilter: z.record(z.unknown()).optional(),
        }),

        func: async (params) => {
            const { input, dbName, collectionName, indexName, embeddingField, textField, k, preFilter } = params;
            const query = input?.trim();
            if (!query) return "Error: Please provide a search query.";

            const db = getDatabase();
            if (!db.connection?.db) return "Error: MongoDB connection not ready.";

            const client = db.connection.getClient();
            const dbRef = client.db(dbName || db.connection.name);
            const collection = dbRef.collection(collectionName);
            const embeddings = createEmbeddings(googleApiKey, googleOptions);

            // mongodb driver version mismatch: mongoose@6 bundles mongodb@4,
            // but @langchain/mongodb expects mongodb@6 Collection type.
            const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
                collection: collection as never,
                indexName,
                textKey: textField,
                embeddingKey: embeddingField,
            });

            try {
                const results = await vectorStore.similaritySearchWithScore(query, Math.min(k, 50), preFilter);
                return results?.length
                    ? formatResults(results as Array<[SearchDocument, number]>)
                    : "No matching documents found.";
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error("Vector search error:", error);
                return `Error: Vector search failed - ${msg}`;
            }
        },
    });
}
