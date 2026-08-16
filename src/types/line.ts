import type { HttpServer } from "../routes";

export interface LineProviderParams {
    token: string;
    secret?: string;
    server?: HttpServer;
    path?: string;
}

export interface WebhookResult {
    success: boolean;
    statusCode?: number;
    error?: string;
}
