import { Elysia } from "elysia";
import { mcpRoutes } from "./mcp";
import { knowledgeRoutes } from "./knowledge";
import { isDatabaseConnected } from "../databases/connection";
import { getMcpServerStatuses } from "../agents/tools";

const GITHUB_REPO_URL = "https://github.com/web-tech-tw/nymph";

export type HealthCheckProbe = () => Record<string, unknown>;
let customHealthProbe: HealthCheckProbe | null = null;

export function registerHealthProbe(probe: HealthCheckProbe): void {
    customHealthProbe = probe;
}

export const server = new Elysia()
    .get("/", ({ redirect }) => redirect(GITHUB_REPO_URL))
    .get("/healthz", ({ set }) => {
        const dbConnected = isDatabaseConnected();
        const mcpStatuses = getMcpServerStatuses();
        const requiredMcpDown = mcpStatuses.some((s) => s.enabled && s.required && !s.connected);
        const healthy = dbConnected && !requiredMcpDown;

        if (!healthy) {
            set.status = 503;
        }

        return {
            status: healthy ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            checks: {
                database: dbConnected ? "connected" : "disconnected",
                mcpServers: mcpStatuses.map((s) => ({
                    name: s.name,
                    connected: s.connected,
                    toolCount: s.toolCount,
                })),
                ...(customHealthProbe ? customHealthProbe() : {}),
            },
        };
    })
    .use(mcpRoutes)
    .use(knowledgeRoutes);

export type HttpServer = Elysia<any, any, any, any, any, any, any>;
export { mcpRoutes };
