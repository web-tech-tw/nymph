import { isProduction, getMust, getEnabled } from "../config.ts";
import { StatusCodes } from "http-status-codes";
import { isObjectPropExists } from "../utils/native.ts";
import type { Request, Response, NextFunction } from "express";

export default (req: Request, res: Response, next: NextFunction) => {
    if (!isObjectPropExists(req.headers, "origin")) {
        if (!isProduction()) {
            console.warn("CORS origin header is not detected");
        }
        next();
        return;
    }

    const actualUrl = req.header("origin");
    const expectedUrl = getMust("CORS_ORIGIN");

    if (actualUrl === expectedUrl) {
        if (!isProduction()) {
            console.warn(
                "CORS origin header match:",
                `actual "${actualUrl}"`,
                `expected "${expectedUrl}"`,
            );
        }
        next();
        return;
    }

    const isEnabledSwagger = getEnabled("ENABLED_SWAGGER");
    const expectedSwaggerUrl = getMust("SWAGGER_CORS_ORIGIN");

    if (isEnabledSwagger && actualUrl === expectedSwaggerUrl) {
        if (!isProduction()) {
            console.warn(
                "CORS origin header from Swagger match:",
                `actual "${actualUrl}"`,
                `expected "${expectedUrl}"`,
            );
        }
        next();
        return;
    }

    if (!isProduction()) {
        console.warn(
            "CORS origin header mismatch:",
            `actual "${actualUrl}"`,
            `expected "${expectedUrl}"`,
        );
    }
    res.sendStatus(StatusCodes.FORBIDDEN);
};
