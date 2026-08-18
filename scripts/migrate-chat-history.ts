import mongoose from "mongoose";

interface LegacySessionDoc {
    _id: mongoose.Types.ObjectId;
    sessionId?: string;
    messages?: Array<{
        type?: string;
        data?: {
            content?: unknown;
        };
    }>;
}

interface NewMessageDoc {
    sessionId: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: Date;
}

function resolveSessionId(rawSessionId: string): string {
    const rawId = rawSessionId.replace(/^nymph:agent:/, "");
    if (rawId.startsWith("!") || rawId.includes(":")) {
        return `Matrix:${rawId}`;
    }
    if (/^[UCR][a-f0-9]{32}$/i.test(rawId)) {
        return `Line:${rawId}`;
    }
    return `Discord:${rawId}`;
}

function extractContent(raw: unknown): string {
    if (typeof raw === "string") {
        return raw.trim();
    }
    if (Array.isArray(raw)) {
        return raw
            .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
            .join("\n")
            .trim();
    }
    if (raw && typeof raw === "object") {
        return JSON.stringify(raw);
    }
    return String(raw || "").trim();
}

async function migrate() {
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

    // 1. Source legacy sessions from either `chat_messages` or `chat_messages_legacy_backup`
    const legacyCol = db.collection("chat_messages_legacy_backup");
    let legacySessions = await legacyCol
        .find<LegacySessionDoc>({ messages: { $exists: true, $type: "array" } })
        .toArray();

    if (legacySessions.length === 0) {
        const altLegacyCol = db.collection("chat_messages");
        legacySessions = await altLegacyCol
            .find<LegacySessionDoc>({ messages: { $exists: true, $type: "array" } })
            .toArray();
    }

    if (legacySessions.length === 0) {
        // If chat_messages already contains flat documents, copy them to chatmessages
        const flatDocs = await db.collection("chat_messages").find({ role: { $exists: true } }).toArray();
        if (flatDocs.length > 0) {
            console.info(`[Migration] Copying ${flatDocs.length} flat documents from 'chat_messages' to 'chatmessages'...`);
            const targetCollection = db.collection("chatmessages");
            await targetCollection.deleteMany({});
            await targetCollection.insertMany(flatDocs);
            await db.collection("chat_messages").drop();
            console.info("[Migration] Dropped old 'chat_messages' collection.");
            console.info("\n[Migration] Migration completed successfully!");
            await mongoose.disconnect();
            return;
        }
        console.info("[Migration] No legacy documents found to migrate.");
        await mongoose.disconnect();
        return;
    }

    console.info(`[Migration] Found ${legacySessions.length} legacy session documents.`);

    // 2. Target standard collection: chatmessages
    const targetCollection = db.collection("chatmessages");

    // 3. Unwind messages into new individual document format
    const newDocs: NewMessageDoc[] = [];
    const now = Date.now();
    for (const session of legacySessions) {
        const targetSessionId = resolveSessionId(session.sessionId || "");

        if (Array.isArray(session.messages)) {
            for (let i = 0; i < session.messages.length; i++) {
                const msg = session.messages[i];
                if (!msg) continue;

                const role = msg.type === "human" ? "user" : msg.type === "ai" ? "assistant" : "system";
                const content = extractContent(msg.data?.content);

                if (content) {
                    newDocs.push({
                        sessionId: targetSessionId,
                        role,
                        content,
                        createdAt: new Date(now - (session.messages.length - i) * 1000),
                    });
                }
            }
        }
    }

    if (newDocs.length > 0) {
        await targetCollection.deleteMany({});
        await targetCollection.insertMany(newDocs);
        console.info(`[Migration] Inserted ${newDocs.length} migrated message documents into 'chatmessages'.`);
    }

    console.info(`\n[Migration] Migration completed successfully! Total messages migrated: ${newDocs.length}`);
    await mongoose.disconnect();
}

migrate().catch((err) => {
    console.error("[Migration] Error during migration:", err);
    process.exit(1);
});
