import { isProduction } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import { useCache } from "../../utils/cache.ts";
import { getIPAddress } from "../../utils/visitor.ts";
import type { Request, Response, NextFunction } from "express";

function buildPathKey(req: Request, stripLast: boolean): string {
    const segments = req.originalUrl.split("/").filter(Boolean);
    if (stripLast) segments.pop();
    return segments.join(".");
}

/**
 * Creates a rate-limiting middleware.
 * @param max        – max forbidden responses before blocking
 * @param ttl        – ttl for the counter in seconds
 * @param stripLast  – strip last path segment (for parameterised routes)
 * @param blockStatus – the status code that triggers counting (default 403)
 */
export default function rateLimiter(
    max: number,
    ttl: number,
    stripLast: boolean,
    blockStatus: number = StatusCodes.FORBIDDEN,
) {
    return (req: Request, res: Response, next: NextFunction) => {
        const cache = useCache();
        const key = ["ratelimit", buildPathKey(req, stripLast), getIPAddress(req)].join(":");
        const current = cache.get<number>(key) ?? 0;

        const increment = () => cache.set(key, current + 1, ttl);

        if (current > max) {
            if (!isProduction()) console.warn("Rate limited:", key, current);
            res.sendStatus(StatusCodes.TOO_MANY_REQUESTS);
            increment();
            return;
        }

        res.on("finish", () => {
            if (res.statusCode === blockStatus) increment();
        });
        next();
    };
}
