import { envRequired } from "../config/index.ts";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import type { Mongoose } from "mongoose";

mongoose.set("strictQuery", true);

const mongoClient = new MongoClient(envRequired("MONGODB_URI"));

export async function connectDatabase(): Promise<Mongoose> {
    return mongoose.connect(envRequired("MONGODB_URI"));
}

export function getDatabase(): Mongoose {
    return mongoose;
}

export function getMongoClient(): MongoClient {
    return mongoClient;
}
