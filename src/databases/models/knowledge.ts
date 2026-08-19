import mongoose, { Schema } from "mongoose";

export interface IKnowledgeDocument {
    text: string;
    metadata: {
        category: string;
        topic: string;
        tags: string[];
        sourceDateRange?: {
            start: string;
            end: string;
        };
        participants?: string[];
        rawMessageCount?: number;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

const KnowledgeSchema = new Schema<IKnowledgeDocument>(
    {
        text: { type: String, required: true },
        metadata: {
            category: { type: String, required: true, index: true },
            topic: { type: String, required: true },
            tags: { type: [String], default: [], index: true },
            sourceDateRange: {
                start: { type: String },
                end: { type: String },
            },
            participants: { type: [String], default: [] },
            rawMessageCount: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
        collection: "knowledge",
    },
);

// Full text search index
KnowledgeSchema.index({ text: "text", "metadata.topic": "text", "metadata.tags": "text" });

export const KnowledgeModel: mongoose.Model<IKnowledgeDocument> =
    (mongoose.models.Knowledge as mongoose.Model<IKnowledgeDocument>) ||
    mongoose.model<IKnowledgeDocument>("Knowledge", KnowledgeSchema);
