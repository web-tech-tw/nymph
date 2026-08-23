import { Elysia } from "elysia";
import { mcpRoutes } from "./mcp";

const GITHUB_REPO_URL = "https://github.com/web-tech-tw/nymph";

export const server = new Elysia()
    .get("/", ({ redirect }) => redirect(GITHUB_REPO_URL))
    .get("/healthz", () => ({
        status: "healthy",
        timestamp: new Date().toISOString(),
    }))
    .use(mcpRoutes);

export type HttpServer = Elysia<any, any, any, any, any, any, any>;
export { mcpRoutes };
