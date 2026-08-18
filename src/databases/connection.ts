import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
    const mongoUri = uri || Bun.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("[Database] MONGODB_URI is required to start the application.");
    }

    try {
        mongoose.set("strictQuery", true);
        await mongoose.connect(mongoUri);
        isConnected = true;
        console.info("[Database] Connected to MongoDB successfully.");
        return mongoose;
    } catch (error) {
        isConnected = false;
        console.error("[Database] Failed to connect to MongoDB:", error);
        throw error;
    }
}

export async function disconnectDatabase(): Promise<void> {
    if (isConnected) {
        await mongoose.disconnect();
        isConnected = false;
        console.info("[Database] Disconnected from MongoDB.");
    }
}

export function isDatabaseConnected(): boolean {
    return isConnected && mongoose.connection.readyState === 1;
}
