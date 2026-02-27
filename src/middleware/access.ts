import { isProduction } from "../config.ts";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
    auth?: {
        id: string | null;
        method: string;
        metadata: any;
    };
}

export default (requiredRole: string | null) =>
    (req: Request | AuthRequest, res: Response, next: NextFunction) => {
        if (!isProduction()) {
            console.warn(
                "An access required request detected:",
                `role "${requiredRole}"`,
                (req as AuthRequest).auth,
                "\n",
            );
        }

        const authReq = req as AuthRequest;
        if (!(authReq.auth && authReq.auth.id)) {
            res.sendStatus(StatusCodes.UNAUTHORIZED);
            return;
        }

        if (
            authReq.auth.method !== "SARA" &&
            !(authReq.auth.method === "TEST" && !isProduction())
        ) {
            res.sendStatus(StatusCodes.METHOD_NOT_ALLOWED);
            return;
        }

        const userRoles = authReq.auth.metadata?.profile?.roles;
        const isUserRolesValid = Array.isArray(userRoles);

        if (
            requiredRole &&
            (!isUserRolesValid || !userRoles.includes(requiredRole))
        ) {
            if (!isProduction()) {
                const displayUserRoles = isUserRolesValid
                    ? userRoles.join(", ")
                    : userRoles;
                console.warn(
                    "An access required request forbidden:",
                    `actual "${displayUserRoles}"`,
                    `expected "${requiredRole}"`,
                    "\n",
                );
            }
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }

        next();
    };
