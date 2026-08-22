import { Elysia } from "elysia";
import { mcpRoutes } from "./mcp";

export const server = new Elysia()
    .get("/", () => ({
        status: "ok",
        service: "nymph",
    }))
    .get("/healthz", () => ({
        status: "healthy",
        timestamp: new Date().toISOString(),
    }))
    .use(mcpRoutes);

export type HttpServer = typeof server;
export { mcpRoutes };
