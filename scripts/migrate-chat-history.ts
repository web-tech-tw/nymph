import mongoose from "mongoose";

interface LegacyDoc {
    _id: mongoose.Types.ObjectId;
    sessionId?: string;
    type?: string;
    data?: {
        content?: string;
    };
    content?: string;
    role?: string;
}

async function migrate() {
    const mongoUri = Bun.env.MONGODB_URI;
    if (!mongoUri) {
        console.error("Error: MONGODB_URI environment variable is required.");
        process.exit(1);
    }

    console.info(`[Migration] Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);

    const collection = mongoose.connection.collection<LegacyDoc>("chat_messages");

    // Find legacy documents with LangChain structure
    const cursor = collection.find({
        $or: [
            { type: { $exists: true } },
            { data: { $exists: true } },
        ],
    });

    let count = 0;
    let converted = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!doc) continue;
        count++;

        const role = doc.role || (doc.type === "human" ? "user" : doc.type === "ai" ? "assistant" : "system");
        const content = doc.content || doc.data?.content || "";

        if (!role || !content) {
            continue;
        }

        await collection.updateOne(
            { _id: doc._id },
            {
                $set: {
                    role,
                    content,
                },
                $unset: {
                    type: "",
                    data: "",
                },
            },
        );
        converted++;
    }

    console.info(`[Migration] Completed. Processed: ${count} documents, Migrated: ${converted} documents.`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error("[Migration] Error during migration:", err);
    process.exit(1);
});
