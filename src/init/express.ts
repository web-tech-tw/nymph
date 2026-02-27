// express.js is a web framework.

// Import config
import {getSplited, getEnabled} from "../config.ts";

// Import express.js
import express from "express";
import type { Request, Response, NextFunction } from "express";

// Create middleware handlers
// import middlewareAuth from "../middleware/auth.ts";

const initDir = new URL(".", import.meta.url).pathname;

// Initialize app engine
const app = express();

// Register global middleware
// app.use(middlewareAuth);

// Read config
const trustProxy = getSplited("TRUST_PROXY", ",");

const isEnabledRedirectHttpHttps = getEnabled("ENABLED_REDIRECT_HTTP_HTTPS");
const isEnabledCors = getEnabled("ENABLED_CORS");
const isEnabledCorsOriginCheck = getEnabled("ENABLED_CORS_ORIGIN_CHECK");

// ejs template engine
app.set("view engine", "ejs");
app.set("views", initDir + "/../../views");

// Optional settings
if (trustProxy.length) {
    app.set("trust proxy", trustProxy);
}

// Optional middleware
if (isEnabledRedirectHttpHttps) {
    const middlewareHttpsRedirect = (await import("../middleware/https_redirect.ts")).default;
    // Do https redirects
    app.use(middlewareHttpsRedirect);
}
if (isEnabledCors) {
    const middlewareCORS = (await import("../middleware/cors.ts")).default;
    // Do CORS handles
    app.use(middlewareCORS);
}
if (isEnabledCors && isEnabledCorsOriginCheck) {
    const middlewareOrigin = (await import("../middleware/origin.ts")).default;
    // Check header "Origin" for CORS
    app.use(middlewareOrigin);
}

// Export useFunction
export const useApp = () => app;

// Export withAwait
export const withAwait = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Export express for shortcut
export { express };
