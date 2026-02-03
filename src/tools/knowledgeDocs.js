"use strict";

const {DynamicStructuredTool} =
    require("@langchain/community/tools/dynamic");
const {z} = require("zod");
const {GoogleGenerativeAIEmbeddings} =
    require("@langchain/google-genai");
const {MongoDBAtlasVectorSearch} =
    require("@langchain/mongodb");
const {useDatabase} = require("../clients/database");

/**
 * Format search results for consistent output.
 *
 * @param {Array} results - Array of [document, score] tuples.
 * @param {number} startIndex - Starting index for numbering.
 * @return {string} Formatted results string.
 */
function formatSearchResults(results, startIndex = 0) {
    return results
        .map(([doc, score], i) => {
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

/**
 * Create embeddings instance with standard config.
 *
 * @param {string} apiKey - Google API key.
 * @param {Object} options - Additional Google GenAI options.
 * @return {GoogleGenerativeAIEmbeddings} Configured instance.
 */
function createEmbeddings(apiKey, options = {}) {
    return new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: options.model ?? "text-embedding-004",
        taskType: options.taskType ?? "RETRIEVAL_DOCUMENT",
        ...options,
    });
}

/**
 * Create a MongoDB Atlas RAG tool with Google GenAI embeddings.
 *
 * Uses LangChain's MongoDBAtlasVectorSearch for optimized
 * vector similarity search on Atlas.
 *
 * @param {Object} opts - Configuration options.
 * @param {string} opts.googleApiKey - Google API key (required).
 * @param {Object} [opts.googleOptions] - Google GenAI config.
 * @return {DynamicStructuredTool} Configured LangChain tool.
 */
function createKnowledgeDocs(opts = {}) {
    const {googleApiKey, googleOptions = {}} = opts;

    // Guard: Validate API key at construction
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

        func: async (params) => {
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

            // Guard: Validate input
            const query = input?.trim();
            if (!query) {
                return "Error: Please provide a search query.";
            }

            // Guard: Check database connection
            const db = useDatabase();
            if (!db?.connection?.db) {
                return (
                    "Error: MongoDB connection not ready. " +
                    "Ensure database is connected."
                );
            }

            // Get collection reference
            const dbRef = db.connection.db.db(
                dbName || db.connection.name,
            );
            const collection = dbRef.collection(collectionName);

            // Create embeddings for vector search
            const embeddings = createEmbeddings(
                googleApiKey,
                googleOptions,
            );

            // Initialize vector store
            const vectorStore = new MongoDBAtlasVectorSearch(
                embeddings,
                {
                    collection,
                    indexName,
                    textKey: textField,
                    embeddingKey: embeddingField,
                },
            );

            // Perform vector similarity search
            try {
                const results =
                    await vectorStore.similaritySearchWithScore(
                        query,
                        Math.min(k, 50),
                        preFilter,
                    );

                // Guard: Check if results found
                if (!results?.length) {
                    return "No matching documents found.";
                }

                return formatSearchResults(results);
            } catch (error) {
                console.error("Vector search error:", error);
                return (
                    `Error: Vector search failed - ${error.message}`
                );
            }
        },
    });
}

module.exports = {
    createKnowledgeDocs,
};
