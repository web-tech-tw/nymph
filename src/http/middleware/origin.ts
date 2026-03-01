import { isProduction, envRequired, envEnabled } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";

export default function originCheck(req: Request, res: Response, next: NextFunction): void {
    const actual = req.header("origin");
    if (!actual) { next(); return; }

    const expected = envRequired("CORS_ORIGIN");
    if (actual === expected) { next(); return; }

    if (envEnabled("ENABLED_SWAGGER") && actual === envRequired("SWAGGER_CORS_ORIGIN")) {
        next();
        return;
    }

    if (!isProduction()) {
        console.warn("CORS origin mismatch:", `actual "${actual}"`, `expected "${expected}"`);
    }
    res.sendStatus(StatusCodes.FORBIDDEN);
}
