import { envList, envEnabled } from "../config/index.ts";
import express from "express";
import type { Request, Response, NextFunction } from "express";

export type { Request, Response, NextFunction };
export { express };

const app = express();

const viewsDir = new URL("../../views", import.meta.url).pathname;
app.set("view engine", "ejs");
app.set("views", viewsDir);

const publicDir = new URL("../../public", import.meta.url).pathname;
app.use(express.static(publicDir));

const trustProxy = envList("TRUST_PROXY", ",");
if (trustProxy.length) app.set("trust proxy", trustProxy);

const corsEnabled = envEnabled("ENABLED_CORS");

if (envEnabled("ENABLED_REDIRECT_HTTP_HTTPS")) {
    const { default: httpsRedirect } = await import("./middleware/https-redirect.ts");
    app.use(httpsRedirect);
}

if (corsEnabled) {
    const { default: cors } = await import("./middleware/cors.ts");
    app.use(cors);
}

if (corsEnabled && envEnabled("ENABLED_CORS_ORIGIN_CHECK")) {
    const { default: origin } = await import("./middleware/origin.ts");
    app.use(origin);
}

export function useApp() {
    return app;
}

/** Wrap an async route handler so rejected promises call next(err). */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
    return (req: Request, res: Response, next: NextFunction) =>
        Promise.resolve(fn(req, res, next)).catch(next);
}
