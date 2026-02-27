import { isProduction } from "../config.ts";
import { StatusCodes } from "http-status-codes";
import { useCache } from "../init/cache.ts";
import { getIPAddress } from "../utils/visitor.ts";
import type { Request, Response, NextFunction } from "express";

function getPathKey(req: Request, isParam: boolean): string {
    const pathArray = req.originalUrl.split("/").filter((i) => !!i);
    if (isParam) {
        pathArray.pop();
    }
    return pathArray.join(".");
}

export default (max: number, ttl: number, isParam: boolean, customForbiddenStatus: number | null = null) =>
    (req: Request, res: Response, next: NextFunction) => {
        const pathKey = getPathKey(req, isParam);
        const visitorKey = getIPAddress(req);
        const queryKey = ["restrictor", pathKey, visitorKey].join(":");

        const cache = useCache();
        const keyValue = cache.get(queryKey) as number | undefined;

        const increaseValue = () => {
            const offset = keyValue ? keyValue + 1 : 1;
            cache.set(queryKey, offset, ttl);
        };

        if (keyValue && keyValue > max) {
            if (!isProduction()) {
                console.warn(
                    "Too many forbidden requests received:",
                    `actual "${keyValue}"`,
                    `expect "${max}"`,
                );
            }
            res.sendStatus(StatusCodes.TOO_MANY_REQUESTS);
            increaseValue();
            return;
        }

        let forbiddenStatus = StatusCodes.FORBIDDEN;
        if (customForbiddenStatus) {
            forbiddenStatus = customForbiddenStatus;
        }

        res.on("finish", () => {
            if (res.statusCode !== forbiddenStatus) {
                return;
            }
            if (!isProduction()) {
                console.warn(
                    "An forbidden request detected:",
                    forbiddenStatus,
                    queryKey,
                );
            }
            increaseValue();
        });

        next();
    };
