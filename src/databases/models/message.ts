import mongoose, { Schema } from "mongoose";
import type { ModelMessage } from "ai";
import type { UserProfile, MessageContentType } from "../../types/provider";
import { isDatabaseConnected } from "../connection";
import { formatUserProfileContext, formatImageMessageTag } from "../../utils/prompts";

export interface IToolCallRecord {
    toolName: string;
    args?: Record<string, unknown>;
}

export interface IChatMessage {
    sessionId: string;
    role: ModelMessage["role"];
    type: MessageContentType;
    content: string;
    toolCalls?: IToolCallRecord[];
    sender?: {
        id?: string;
        nickname?: string;
    };
    createdAt?: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        sessionId: { type: String, required: true, index: true },
        role: { type: String, required: true, enum: ["user", "assistant", "system", "tool"] },
        type: { type: String, required: true, enum: ["text", "image"] },
        content: { type: String, required: true },
        toolCalls: {
            type: [
                {
                    toolName: { type: String, required: true },
                    args: { type: Schema.Types.Mixed },
                },
            ],
            default: undefined,
        },
        sender: {
            id: { type: String },
            nickname: { type: String },
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    },
);

ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const ChatMessageModel: mongoose.Model<IChatMessage> =
    (mongoose.models.ChatMessage as mongoose.Model<IChatMessage>) ||
    mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export async function getHistoryMessages(sessionId: string, limit = 20): Promise<ModelMessage[]> {
    if (!isDatabaseConnected()) {
        return [];
    }

    try {
        const docs = await ChatMessageModel.find({ sessionId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const reversed = docs.reverse();
        return reversed.map((doc) => {
            let content = doc.type === "image" ? formatImageMessageTag(doc.content) : doc.content;
            if (doc.role === "user") {
                content = formatUserProfileContext(content, doc.sender);
            }
            return {
                role: doc.role,
                content,
            } as ModelMessage;
        });
    } catch (error) {
        console.error("[Database] Failed to get chat history:", error);
        return [];
    }
}

export async function saveChatMessage(params: {
    sessionId: string;
    role: ModelMessage["role"];
    type: MessageContentType;
    content: string;
    toolCalls?: IToolCallRecord[];
    sender?: UserProfile;
}): Promise<void> {
    if (!isDatabaseConnected()) {
        return;
    }

    try {
        await ChatMessageModel.create({
            sessionId: params.sessionId,
            role: params.role,
            type: params.type,
            content: params.content,
            toolCalls: params.toolCalls?.length ? params.toolCalls : undefined,
            sender: params.sender
                ? {
                    id: params.sender.id,
                    nickname: params.sender.nickname,
                }
                : undefined,
        });
    } catch (error) {
        console.error("[Database] Failed to save chat message:", error);
    }
}

export interface SearchChatHistoryQueryOptions {
    query?: string;
    role?: "all" | "user" | "assistant" | string;
    sessionId?: string;
    limit?: number;
}

export interface ChatHistorySearchResult {
    total: number;
    returned?: number;
    messages: Array<{
        turn?: number;
        role: string;
        content: string;
        sessionId?: string;
        createdAt?: string;
        sender?: { id?: string; nickname?: string };
    }>;
    message?: string;
}

export async function searchChatHistoryMessages(
    options: SearchChatHistoryQueryOptions = {},
): Promise<ChatHistorySearchResult> {
    if (!isDatabaseConnected()) {
        return {
            total: 0,
            messages: [],
            message: "No conversation history available.",
        };
    }

    try {
        const { query = "", role = "all", sessionId, limit = 10 } = options;
        const sessionFilter: Record<string, unknown> = {};
        if (sessionId && sessionId.trim()) {
            sessionFilter.sessionId = sessionId.trim();
        }

        const totalInScope = await ChatMessageModel.countDocuments(sessionFilter);
        if (totalInScope === 0) {
            return {
                total: 0,
                messages: [],
                message: "No conversation history available.",
            };
        }

        const filter: Record<string, unknown> = { ...sessionFilter };
        const roleLower = (role || "all").trim().toLowerCase();
        if (roleLower === "user" || roleLower === "assistant") {
            filter.role = roleLower;
        }

        const queryTrimmed = query.trim();
        if (queryTrimmed) {
            const escaped = queryTrimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.content = { $regex: escaped, $options: "i" };
        }

        const effectiveLimit = Math.max(1, Math.min(limit, 50));
        const totalMatches = await ChatMessageModel.countDocuments(filter);

        if (totalMatches === 0) {
            return {
                total: 0,
                messages: [],
                message: queryTrimmed
                    ? `No messages matching query '${queryTrimmed}' were found.`
                    : "No matching messages found.",
            };
        }

        const docs = await ChatMessageModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(effectiveLimit)
            .lean();

        const reversed = docs.reverse();
        const matches = reversed.map((doc, idx) => ({
            turn: idx + 1,
            role: doc.role,
            content: doc.type === "image" ? formatImageMessageTag(doc.content) : doc.content,
            sessionId: doc.sessionId,
            createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
            sender: doc.sender?.nickname || doc.sender?.id ? doc.sender : undefined,
        }));

        return {
            total: totalMatches,
            returned: matches.length,
            messages: matches,
        };
    } catch (error) {
        console.error("[Database] Failed to search chat history:", error);
        return {
            total: 0,
            messages: [],
            message: "Failed to search chat history due to a database error.",
        };
    }
}
