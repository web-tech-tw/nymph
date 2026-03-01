import { isProduction } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import { validationResult } from "express-validator";
import type { Request, Response, NextFunction } from "express";

export default function inspector(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    if (errors.isEmpty()) { next(); return; }

    if (!isProduction()) console.warn("Bad request:", errors);
    res.status(StatusCodes.BAD_REQUEST).json({ errors: errors.array() });
}
