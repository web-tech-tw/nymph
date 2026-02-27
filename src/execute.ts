// Import config
import {getMust, getSplited} from "./config.ts";

// Import modules
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { Express } from "express";

// Import event listener
import {
    listen as startListenEvents,
} from "./init/listener.ts";

interface ProtocolInfo {
    protocol: string;
    hostname: string;
    port: number;
}

/**
 * Setup protocol - http
 * @param {object} app
 * @param {function} callback
 */
function setupHttpProtocol(app: Express, callback: (info: ProtocolInfo) => void) {
    const options = {};
    const httpServer = http.createServer(options, app);
    const port = parseInt(getMust("HTTP_PORT"));
    httpServer.listen(port, getMust("HTTP_HOSTNAME"));
    callback({protocol: "http", hostname: getMust("HTTP_HOSTNAME"), port});
}

/**
 * Setup protocol - https
 * @param {object} app
 * @param {function} callback
 */
function setupHttpsProtocol(app: Express, callback: (info: ProtocolInfo) => void) {
    const options = {
        key: fs.readFileSync(getMust("HTTPS_KEY_PATH")),
        cert: fs.readFileSync(getMust("HTTPS_CERT_PATH")),
    };
    const httpsServer = https.createServer(options, app);
    const port = parseInt(getMust("HTTPS_PORT"));
    httpsServer.listen(port, getMust("HTTPS_HOSTNAME"));
    callback({protocol: "https", hostname: getMust("HTTPS_HOSTNAME"), port});
}

// Prepare application and detect protocols automatically
export default async function(app: Express, prepareHandlers: (() => Promise<void>)[], callback: (info: ProtocolInfo) => void) {
    // Waiting for prepare handlers
    if (prepareHandlers.length > 0) {
        const preparingPromises = prepareHandlers.map((c) => c());
        await Promise.all(preparingPromises);
    }

    // Get enabled protocols
    const enabledProtocols = getSplited("ENABLED_PROTOCOLS");

    // Setup HTTP
    if (enabledProtocols.includes("http")) {
        setupHttpProtocol(app, callback);
    }

    // Setup HTTPS
    if (enabledProtocols.includes("https")) {
        setupHttpsProtocol(app, callback);
    }

    // Start event listener
    startListenEvents();
}
