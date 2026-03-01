import { envRequired, envList } from "../config/index.ts";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { Express } from "express";
import type { ProtocolInfo } from "../types.ts";

function startHttp(app: Express, callback: (info: ProtocolInfo) => void): void {
    const hostname = envRequired("HTTP_HOSTNAME");
    const port = parseInt(envRequired("HTTP_PORT"), 10);
    http.createServer(app).listen(port, hostname);
    callback({ protocol: "http", hostname, port });
}

function startHttps(app: Express, callback: (info: ProtocolInfo) => void): void {
    const hostname = envRequired("HTTPS_HOSTNAME");
    const port = parseInt(envRequired("HTTPS_PORT"), 10);
    const options = {
        key: fs.readFileSync(envRequired("HTTPS_KEY_PATH")),
        cert: fs.readFileSync(envRequired("HTTPS_CERT_PATH")),
    };
    https.createServer(options, app).listen(port, hostname);
    callback({ protocol: "https", hostname, port });
}

export function startServer(app: Express, callback: (info: ProtocolInfo) => void): void {
    const protocols = envList("ENABLED_PROTOCOLS");
    if (protocols.includes("http")) startHttp(app, callback);
    if (protocols.includes("https")) startHttps(app, callback);
}
