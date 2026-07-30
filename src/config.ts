import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

export type ProviderType = "discord" | "matrix" | "line" | "anthropic";

export interface HttpConfigSchema {
    bindHost: string;
    bindPort: number;
    baseUrl: string;
}

export interface BridgeConfigSchema {
    public: boolean;
}

export interface BridgeProviderBaseConfigSchema {
    enable: boolean;
}

export interface BridgeProviderDiscordConfigSchema extends BridgeProviderBaseConfigSchema {
    appId: string;
    botToken: string;
}

export interface BridgeProviderMatrixConfigSchema extends BridgeProviderBaseConfigSchema {
    homeserverUrl: string;
    accessToken: string;
}

export interface BridgeProviderLineConfigSchema extends BridgeProviderBaseConfigSchema {
    channelAccessToken: string;
    channelSecret: string;
}

export interface BridgeProviderAnthropicConfigSchema extends BridgeProviderBaseConfigSchema {
    apiKey: string;
    model: string;
}

export type BridgeProviderConfigSchema = {
    discord: BridgeProviderDiscordConfigSchema;
    matrix: BridgeProviderMatrixConfigSchema;
    line: BridgeProviderLineConfigSchema;
    anthropic: BridgeProviderAnthropicConfigSchema;
};

export interface AppConfigSchema {
    deviceName: string;
    http: HttpConfigSchema;
    bridge: BridgeConfigSchema;
    relays: Record<string, string>[];
    bridgeProvider: BridgeProviderConfigSchema;
}

function loadConfig(): AppConfigSchema {
    const primaryPath = resolve(process.cwd(), "config.yaml");
    const samplePath = resolve(process.cwd(), "config.sample.yaml");
    const targetPath = existsSync(primaryPath) ? primaryPath : samplePath;

    try {
        const content = readFileSync(targetPath, "utf-8");
        return parse(content) as AppConfigSchema;
    } catch (err) {
        console.error("[Config]: Failed to read config.yaml:", err);
        return {
            deviceName: "Nymph",
            http: { bindHost: "0.0.0.0", bindPort: 3000, baseUrl: "http://localhost:3000" },
            bridge: { public: false },
            relays: [],
            bridgeProvider: {
                discord: { enable: false, appId: "", botToken: "" },
                matrix: { enable: false, homeserverUrl: "", accessToken: "" },
                line: { enable: false, channelAccessToken: "", channelSecret: "" },
                anthropic: { enable: false, apiKey: "", model: "claude-3-5-sonnet-20241022" },
            },
        };
    }
}

const config = loadConfig();

export function appConfig(): AppConfigSchema {
    return config;
}

export function httpConfig(): HttpConfigSchema {
    return config.http;
}

export function bridgeConfig(): BridgeConfigSchema {
    return config.bridge;
}

export function bridgeProviderConfig(): BridgeProviderConfigSchema {
    return config.bridgeProvider;
}

export function getRelayConfigs(): Record<string, string>[] {
    return config.relays ?? [];
}

export function get(key: string, defaultValue?: string): string {
    const val = process.env[key] ?? defaultValue;
    if (val === undefined) {
        throw new Error(`Config key ${key} is undefined`);
    }
    return val;
}

export function getOptional(key: string): string | undefined {
    return process.env[key];
}

export function getEnabled(key: string): boolean {
    const val = process.env[key];
    return val === "yes" || val === "true";
}

export function getSplitted(key: string, separator = ","): string[] {
    const val = process.env[key];
    if (!val) return [];
    return val.split(separator).map((s) => s.trim()).filter(Boolean);
}

export function getNodeEnv(): string {
    return process.env.NODE_ENV || "development";
}

export function getRuntimeEnv(): string {
    return process.env.RUNTIME_ENV || "native";
}

export function isProduction(): boolean {
    return getNodeEnv() === "production";
}

export function getEnvironmentOverview() {
    return {
        node: getNodeEnv(),
        runtime: getRuntimeEnv(),
    } as const;
}
