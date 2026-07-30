import mongoose from "mongoose";
import { MongoClient } from "mongodb";

mongoose.set("strictQuery", true);

let _mongoClient: MongoClient | undefined;

export function getMongoClient(): MongoClient {
    if (!_mongoClient) {
        const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/nymph";
        _mongoClient = new MongoClient(uri);
    }
    return _mongoClient;
}

export async function connectMemory(): Promise<typeof mongoose> {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/nymph";
    return mongoose.connect(uri);
}

export interface IMatrixAccess {
    username: string;
    accessToken: string;
}

const matrixAccessSchema = new mongoose.Schema<IMatrixAccess>(
    {
        username: { type: String, required: true, unique: true },
        accessToken: { type: String, required: true },
    },
    { timestamps: true },
);

export const MatrixAccess = mongoose.models.MatrixAccess || mongoose.model<IMatrixAccess>("MatrixAccess", matrixAccessSchema);

export interface IRoom {
    roomId: string;
    platform: string;
    enabled: boolean;
}

const roomSchema = new mongoose.Schema<IRoom>(
    {
        roomId: { type: String, required: true, unique: true },
        platform: { type: String, required: true },
        enabled: { type: Boolean, default: true },
    },
    { timestamps: true },
);

export const Room = mongoose.models.Room || mongoose.model<IRoom>("Room", roomSchema);
