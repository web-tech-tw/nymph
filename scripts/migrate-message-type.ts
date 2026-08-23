import mongoose from "mongoose";

export interface MessageTypeMigrationResult {
    imageMessagesUpdated: number;
    textMessagesUpdated: number;
}

export function parseMessageContent(rawContent: string): { type: "text" | "image"; content: string } {
    const trimmed = rawContent.trim();
    const match = trimmed.match(/^\[image:(.+)\]$/);
    if (match && match[1]) {
        return {
            type: "image",
            content: match[1].trim(),
        };
    }
    return {
        type: "text",
        content: rawContent,
    };
}

export async function migrateMessageTypes(db: mongoose.mongo.Db): Promise<MessageTypeMigrationResult> {
    const collection = db.collection("chatmessages");

    // 1. Process documents with image pattern [image:id] in content
    const imageDocs = await collection
        .find({
            content: { $regex: /^\[image:.+\]$/ },
        })
        .toArray();

    let imageMessagesUpdated = 0;
    if (imageDocs.length > 0) {
        const imageBulkOps = [];
        for (const doc of imageDocs) {
            if (typeof doc.content !== "string") continue;
            const parsed = parseMessageContent(doc.content);
            if (parsed.type === "image") {
                imageBulkOps.push({
                    updateOne: {
                        filter: { _id: doc._id },
                        update: {
                            $set: {
                                type: "image",
                                content: parsed.content,
                            },
                        },
                    },
                });
                imageMessagesUpdated++;
            }
        }

        if (imageBulkOps.length > 0) {
            await collection.bulkWrite(imageBulkOps);
        }
    }

    // 2. Backfill default type: "text" for all documents missing a valid type
    const textUpdateResult = await collection.updateMany(
        {
            $or: [
                { type: { $exists: false } },
                { type: null },
                { type: { $nin: ["text", "image"] } },
            ],
        },
        {
            $set: {
                type: "text",
            },
        },
    );

    const textMessagesUpdated = textUpdateResult.modifiedCount;

    return {
        imageMessagesUpdated,
        textMessagesUpdated,
    };
}

async function run() {
    const mongoUri = Bun.env.MONGODB_URI;
    if (!mongoUri) {
        console.error("Error: MONGODB_URI environment variable is required.");
        process.exit(1);
    }

    console.info("[Migration] Connecting to MongoDB...");
    await mongoose.connect(mongoUri);

    const db = mongoose.connection.db;
    if (!db) {
        console.error("Error: Failed to obtain database instance.");
        process.exit(1);
    }

    console.info("[Migration] Migrating message types in 'chatmessages' collection...");
    const result = await migrateMessageTypes(db);

    console.info(`[Migration] Updated ${result.imageMessagesUpdated} image message(s) with extracted ID.`);
    console.info(`[Migration] Backfilled ${result.textMessagesUpdated} message(s) with type 'text'.`);
    console.info("\n[Migration] Message type migration completed successfully!");

    await mongoose.disconnect();
}

if (import.meta.main) {
    run().catch((err) => {
        console.error("[Migration] Error during message type migration:", err);
        process.exit(1);
    });
}
