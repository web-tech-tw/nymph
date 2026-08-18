import mongoose, { Schema } from "mongoose";
import type { ModelMessage } from "ai";
import type { UserProfile } from "../../types/provider";
import { isDatabaseConnected } from "../connection";

export interface IChatMessage {
    sessionId: string;
    role: "user" | "assistant" | "system";
    content: string;
    sender?: {
        id?: string;
        nickname?: string;
    };
    createdAt?: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
    {
        sessionId: { type: String, required: true, index: true },
        role: { type: String, required: true, enum: ["user", "assistant", "system"] },
        content: { type: String, required: true },
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
        return reversed.map((doc) => ({
            role: doc.role as "user" | "assistant",
            content: doc.content,
        }));
    } catch (error) {
        console.error("[Database] Failed to get chat history:", error);
        return [];
    }
}

export async function saveChatMessage(params: {
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    sender?: UserProfile;
}): Promise<void> {
    if (!isDatabaseConnected()) {
        return;
    }

    try {
        await ChatMessageModel.create({
            sessionId: params.sessionId,
            role: params.role,
            content: params.content,
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
