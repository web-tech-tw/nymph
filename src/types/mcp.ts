import type { HttpServer } from "../routes";

export interface McpProviderParams {
    server?: HttpServer;
    path?: string;
    enabled?: boolean;
}
