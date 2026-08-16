import { Elysia } from "elysia";

export const server = new Elysia()
    .get("/", () => ({
        status: "ok",
        service: "nymph",
    }))
    .get("/health", () => ({
        status: "healthy",
        timestamp: new Date().toISOString(),
    }));

export type HttpServer = typeof server;
