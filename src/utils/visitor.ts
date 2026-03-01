import { isProduction } from "../config/index.ts";
import uaParser from "ua-parser-js";
import type { Request } from "express";

export function getIPAddress(req: Request): string {
    return isProduction() ? (req.ip ?? "Unknown") : "127.0.0.1";
}

export function getUserAgent(req: Request, short = false): string {
    const raw = req.header("user-agent");
    if (!raw) return "Unknown";
    if (!short) return raw;

    const parsed = uaParser(raw);
    const { name: browserName } = parsed.browser;
    const { name: osName } = parsed.os;
    return [browserName, osName].filter(Boolean).join(" ");
}
