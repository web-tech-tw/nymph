export const PIPELINE_CONFIG = {
    source: {
        uri: Bun.env.SOURCE_MONGODB_URI || "",
        dbName: Bun.env.SOURCE_MONGODB_DB_NAME || "openchat",
        collectionName: Bun.env.SOURCE_MONGODB_COLLECTION || "messages",
    },
    target: {
        uri: Bun.env.MONGODB_URI || "mongodb://localhost:27017/nymph",
        collectionName: "knowledge",
    },
    llm: {
        model: Bun.env.ETL_ANTHROPIC_MODEL || "claude-haiku-4-5",
        apiKey: Bun.env.ETL_ANTHROPIC_API_KEY || "",
        baseURL: Bun.env.ETL_ANTHROPIC_BASE_URL,
        thinking: Bun.env.ETL_ANTHROPIC_THINKING,
        concurrency: 10,
    },
    thresholds: {
        authorMinOccurrences: 2,
        maxAuthorTokens: 4,
        continuousMergeSeconds: 45,
        threadGapMinutes: 10,
        minThreadMessages: 2,
    },
};
