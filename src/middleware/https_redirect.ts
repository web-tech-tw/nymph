import { isProduction } from "../config.ts";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";

export default (req: Request, res: Response, next: NextFunction) => {
    if (req.protocol === "http") {
        if (!isProduction()) {
            console.warn(
                "Pure HTTP protocol detected:",
                `from "${req.hostname}"`,
                `with host header "${req.headers.host}"`,
                `with origin header "${req.headers.origin}"`,
            );
        }
        res.redirect(
            StatusCodes.MOVED_PERMANENTLY,
            `https://${req.headers.host}${req.url}`,
        );
    }

    next();
};
