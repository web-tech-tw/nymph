import mongoose, { Schema } from "mongoose";
import { isDatabaseConnected } from "../connection";

export interface IPipelineCheckpoint {
    key: string;
    completedDates: string[];
    totalExtracted: number;
    lastProcessedDate?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const PipelineCheckpointSchema = new Schema<IPipelineCheckpoint>(
    {
        key: { type: String, required: true, unique: true, index: true },
        completedDates: { type: [String], default: [] },
        totalExtracted: { type: Number, default: 0 },
        lastProcessedDate: { type: String },
    },
    {
        timestamps: true,
        collection: "checkpoints",
    },
);

export const PipelineCheckpointModel: mongoose.Model<IPipelineCheckpoint> =
    (mongoose.models.PipelineCheckpoint as mongoose.Model<IPipelineCheckpoint>) ||
    mongoose.model<IPipelineCheckpoint>("PipelineCheckpoint", PipelineCheckpointSchema);

export async function getDbCheckpoint(key = "chat-technical-etl"): Promise<{
    completedDates: string[];
    totalExtracted: number;
}> {
    if (!isDatabaseConnected() && mongoose.connection.readyState !== 1) {
        return { completedDates: [], totalExtracted: 0 };
    }

    try {
        const doc = await PipelineCheckpointModel.findOne({ key }).lean();
        return {
            completedDates: doc?.completedDates || [],
            totalExtracted: doc?.totalExtracted || 0,
        };
    } catch (error) {
        console.error("[Checkpoint] Failed to fetch database checkpoint:", error);
        return { completedDates: [], totalExtracted: 0 };
    }
}

export async function updateDbCheckpoint(params: {
    key?: string;
    completedDate: string;
    extractedCount: number;
}): Promise<void> {
    const key = params.key || "chat-technical-etl";
    if (!isDatabaseConnected() && mongoose.connection.readyState !== 1) {
        return;
    }

    try {
        await PipelineCheckpointModel.updateOne(
            { key },
            {
                $addToSet: { completedDates: params.completedDate },
                $inc: { totalExtracted: params.extractedCount },
                $set: { lastProcessedDate: params.completedDate },
            },
            { upsert: true },
        );
    } catch (error) {
        console.error("[Checkpoint] Failed to update database checkpoint:", error);
    }
}

export async function resetDbCheckpoint(key = "chat-technical-etl"): Promise<void> {
    if (!isDatabaseConnected() && mongoose.connection.readyState !== 1) {
        return;
    }

    try {
        await PipelineCheckpointModel.deleteOne({ key });
    } catch (error) {
        console.error("[Checkpoint] Failed to reset database checkpoint:", error);
    }
}
