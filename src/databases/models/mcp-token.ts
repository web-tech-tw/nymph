import mongoose, { Schema, type Document } from "mongoose";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

export interface IMcpToken {
    userId: string;
    token: string;
    label: string;
    lastUsedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export type IMcpTokenRecord = IMcpToken & { _id?: string };

export interface IMcpTokenDocument extends Document {
    _id: string;
    userId: string;
    token: string;
    label: string;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const McpTokenSchema = new Schema<IMcpTokenDocument>(
    {
        _id: { type: String, default: () => nanoid() },
        userId: { type: String, required: true, index: true },
        token: { type: String, required: true, unique: true, index: true },
        label: { type: String, required: true, default: "MCP Token" },
        lastUsedAt: { type: Date },
    },
    {
        timestamps: true,
        collection: "mcp_tokens",
    },
);

export function generateMcpTokenSecret(): string {
    return `nfm-${nanoid(16)}_${randomBytes(24).toString("hex")}`;
}

export const McpTokenModel: mongoose.Model<IMcpTokenDocument> =
    (mongoose.models.McpToken as mongoose.Model<IMcpTokenDocument>) ||
    mongoose.model<IMcpTokenDocument>("McpToken", McpTokenSchema);

// In-memory fallback for testing or when DB is offline
const inMemoryTokens = new Map<string, IMcpTokenRecord>();

function isDbReady(): boolean {
    return mongoose.connection.readyState === 1;
}

export async function createMcpToken(
    userId: string,
    label?: string,
): Promise<IMcpTokenRecord> {
    const token = generateMcpTokenSecret();
    const tokenLabel = label?.trim() || "MCP Token";

    if (!isDbReady()) {
        const id = nanoid();
        const now = new Date();
        const entry: IMcpTokenRecord = {
            _id: id,
            userId,
            token,
            label: tokenLabel,
            createdAt: now,
            updatedAt: now,
        };
        inMemoryTokens.set(id, entry);
        return entry;
    }

    const doc = new McpTokenModel({
        _id: nanoid(),
        userId,
        token,
        label: tokenLabel,
    });
    await doc.save();
    return doc.toObject() as IMcpTokenRecord;
}

export async function listMcpTokens(
    userId: string,
): Promise<IMcpTokenRecord[]> {
    if (!isDbReady()) {
        return Array.from(inMemoryTokens.values()).filter((t) => t.userId === userId);
    }
    const docs = await McpTokenModel.find({ userId }).sort({ createdAt: -1 }).lean().exec();
    return docs as unknown as IMcpTokenRecord[];
}

export async function deleteMcpToken(
    userId: string,
    identifier: { id?: string; token?: string },
): Promise<boolean> {
    if (!isDbReady()) {
        for (const [id, entry] of inMemoryTokens.entries()) {
            if (entry.userId === userId && (identifier.id === id || identifier.token === entry.token)) {
                inMemoryTokens.delete(id);
                return true;
            }
        }
        return false;
    }

    const filter: Record<string, unknown> = { userId };
    if (identifier.id) {
        filter._id = identifier.id;
    } else if (identifier.token) {
        filter.token = identifier.token;
    } else {
        return false;
    }

    const res = await McpTokenModel.findOneAndDelete(filter).exec();
    return Boolean(res);
}

export async function updateMcpTokenLabel(
    userId: string,
    identifier: { id?: string; token?: string },
    label: string,
): Promise<IMcpTokenRecord | null> {
    const trimmedLabel = label.trim();

    if (!isDbReady()) {
        for (const [id, entry] of inMemoryTokens.entries()) {
            if (entry.userId === userId && (identifier.id === id || identifier.token === entry.token)) {
                entry.label = trimmedLabel;
                entry.updatedAt = new Date();
                return entry;
            }
        }
        return null;
    }

    const filter: Record<string, unknown> = { userId };
    if (identifier.id) {
        filter._id = identifier.id;
    } else if (identifier.token) {
        filter.token = identifier.token;
    } else {
        return null;
    }

    const doc = await McpTokenModel.findOneAndUpdate(
        filter,
        { label: trimmedLabel },
        { new: true },
    ).lean().exec();

    return doc as unknown as IMcpTokenRecord | null;
}

export async function rotateMcpToken(
    userId: string,
    identifier: { id?: string; token?: string },
): Promise<IMcpTokenRecord | null> {
    const newToken = generateMcpTokenSecret();

    if (!isDbReady()) {
        for (const [id, entry] of inMemoryTokens.entries()) {
            if (entry.userId === userId && (identifier.id === id || identifier.token === entry.token)) {
                entry.token = newToken;
                entry.updatedAt = new Date();
                return entry;
            }
        }
        return null;
    }

    const filter: Record<string, unknown> = { userId };
    if (identifier.id) {
        filter._id = identifier.id;
    } else if (identifier.token) {
        filter.token = identifier.token;
    } else {
        return null;
    }

    const doc = await McpTokenModel.findOneAndUpdate(
        filter,
        { token: newToken },
        { new: true },
    ).lean().exec();

    return doc as unknown as IMcpTokenRecord | null;
}

export async function findAndTouchMcpToken(token: string): Promise<IMcpTokenRecord | null> {
    if (!token) return null;

    const now = new Date();
    if (!isDbReady()) {
        for (const entry of inMemoryTokens.values()) {
            if (entry.token === token) {
                entry.lastUsedAt = now;
                return entry;
            }
        }
        return null;
    }

    const doc = await McpTokenModel.findOneAndUpdate(
        { token },
        { lastUsedAt: now },
        { new: true },
    ).lean().exec();

    return doc as unknown as IMcpTokenRecord | null;
}
