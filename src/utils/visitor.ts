// The simple toolbox for fetch visitor information from HTTP request.

import { isProduction } from "../config.ts";
import uaParser from "ua-parser-js";
import type { Request } from "express";

export function getIPAddress(req: Request): string {
    if (!isProduction()) {
        return "127.0.0.1";
    }
    return req.ip;
}

export function getUserAgent(req: Request, isShort = false): string {
    const userAgent = req.header("user-agent");
    if (!userAgent) {
        return "Unknown";
    }

    if (!isShort) {
        return userAgent;
    }

    const uaParsed = uaParser(userAgent);
    const { name: browserName } = uaParsed.browser;
    const { name: osName } = uaParsed.os;
    return [browserName, osName].join(" ");
}
