import { isProduction } from "../config.ts";
import { StatusCodes } from "http-status-codes";
import { validationResult } from "express-validator";
import type { Request, Response, NextFunction } from "express";

export default (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        next();
    } else {
        if (!isProduction()) {
            console.warn("A bad request received:", errors);
        }
        res
            .status(StatusCodes.BAD_REQUEST)
            .json({ errors: errors.array() });
    }
};
