import { isProduction } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";

export default function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
    if (req.protocol === "http") {
        if (!isProduction()) {
            console.warn("HTTP redirect:", req.hostname, req.headers.host);
        }
        res.redirect(StatusCodes.MOVED_PERMANENTLY, `https://${req.headers.host}${req.url}`);
        return;
    }
    next();
}
