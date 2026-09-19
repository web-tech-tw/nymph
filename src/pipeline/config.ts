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
        model: Bun.env.ETL_OPENAI_MODEL || Bun.env.ETL_NIM_MODEL || "openai/gpt-oss-120b",
        apiKey: Bun.env.ETL_OPENAI_API_KEY || Bun.env.ETL_NIM_API_KEY || "",
        baseURL: Bun.env.ETL_OPENAI_BASE_URL || Bun.env.ETL_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
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
