// mongoose is an ODM library for MongoDB.

// Import config
import { getMust } from "../config.ts";

// Import mongoose
import database from "mongoose";

// Configure mongoose
database.set("strictQuery", true);

// Connect to MongoDB
export const prepare = () => database.connect(getMust("MONGODB_URI"));

// Export as useFunction
export const useDatabase = () => database;
