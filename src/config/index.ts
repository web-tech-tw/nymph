import { join as pathJoin } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const projectRoot = new URL("../..", import.meta.url).pathname;
const dotenvPath = pathJoin(projectRoot, ".env");

if (!existsSync(dotenvPath) && process.env.APP_CONFIGURED !== "1") {
    throw new Error(
        "No '.env' file detected in project root. " +
        "Set APP_CONFIGURED=1 if you configure via environment variables.",
    );
}

dotenv.config({ path: dotenvPath });

export function env(key: string): string | undefined {
    return process.env[key];
}

export function envRequired(key: string): string {
    const value = process.env[key];
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export function envOr(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
}

export function envEnabled(key: string): boolean {
    return envRequired(key) === "yes";
}

export function envList(key: string, separator = ","): string[] {
    return envRequired(key)
        .split(separator)
        .map((s) => s.trim())
        .filter(Boolean);
}

export function isProduction(): boolean {
    return envRequired("NODE_ENV") === "production";
}

export function getEnvironmentOverview() {
    return {
        node: envOr("NODE_ENV", "development"),
        runtime: envOr("RUNTIME_ENV", "native"),
    } as const;
}
