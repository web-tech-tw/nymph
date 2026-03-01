import { isProduction } from "../../config/index.ts";
import { StatusCodes } from "http-status-codes";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest, UserProfile } from "../../types.ts";

/**
 * Returns middleware that requires a specific role.
 * Pass `null` to require authentication without role checking.
 */
export default function requireAccess(requiredRole: string | null) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!isProduction()) {
            console.warn("Access check:", `role "${requiredRole}"`, req.auth);
        }

        if (!req.auth?.id) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }

        if (req.auth.method !== "SARA" && !(req.auth.method === "TEST" && !isProduction())) {
            res.sendStatus(StatusCodes.METHOD_NOT_ALLOWED);
            return;
        }

        const profile = req.auth.metadata?.profile as UserProfile | undefined;
        const roles = profile?.roles;

        if (requiredRole && (!Array.isArray(roles) || !roles.includes(requiredRole))) {
            if (!isProduction()) {
                console.warn("Access denied:", `actual "${roles}"`, `expected "${requiredRole}"`);
            }
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        next();
    };
}
