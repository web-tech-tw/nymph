import { envRequired } from "../config/index.ts";
import mongoose from "mongoose";
import type { Mongoose } from "mongoose";

mongoose.set("strictQuery", true);

export async function connectDatabase(): Promise<Mongoose> {
    return mongoose.connect(envRequired("MONGODB_URI"));
}

export function getDatabase(): Mongoose {
    return mongoose;
}
