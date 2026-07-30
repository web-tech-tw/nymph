import { Schema, model } from "mongoose";
import type { RoomMode, Platform } from "../../types.ts";

export interface IRoom {
    platform: Platform;
    roomId: string;
    mode: RoomMode;
    languages: string[];
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<IRoom>({
    platform: { type: String, required: true },
    roomId: { type: String, required: true },
    mode: {
        type: String,
        enum: ["normal", "translator"],
        default: "normal",
    },
    languages: {
        type: [String],
        default: [],
        validate: {
            validator: (v: string[]) => !v || v.length === 0 || v.length === 2,
            message: "languages must be empty or contain exactly 2 codes",
        },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

schema.index({ platform: 1, roomId: 1 }, { unique: true });

export const Room = model<IRoom>("Room", schema);
