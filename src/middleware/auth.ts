// Validate "Authorization" header, but it will not interrupt the request.

// To interrupt the request which without the request,
// please use "access.js" middleware.

// Import isProduction
import {isProduction} from "../config.ts";

// Import isObjectPropExists
import {isObjectPropExists} from "../utils/native.ts";

import * as saraTokenAuth from "../utils/sara_token.ts";
import * as testTokenAuth from "../utils/test_token.ts";
import type { Request, Response, NextFunction } from "express";

// Define a custom interface for Request with auth
export interface AuthRequest extends Request {
    auth?: {
        id: string | null;
        method: string;
        secret: string;
        metadata: any;
    };
}

// Import authMethods
const authMethods: Record<string, (token: string) => Promise<any> | any> = {
    "SARA": saraTokenAuth.validate,
    "TEST": testTokenAuth.validate,
};

// Export (function)
export default async (req: AuthRequest, _: Response, next: NextFunction) => {
    const authCode = req.header("authorization");
    if (!authCode) {
        next();
        return;
    }

    const params = authCode.split(" ");
    if (params.length !== 2) {
        next();
        return;
    }
    const [method, secret] = params;

    req.auth = {
        id: null,
        metadata: null,
        method,
        secret,
    };
    if (!isObjectPropExists(authMethods, req.auth.method)) {
        next();
        return;
    }

    const authMethod = authMethods[method];
    const authResult = await authMethod(secret);

    if (!isProduction()) {
        // Debug message
        console.warn(
            "An authentication detected:",
            method, authResult,
            "\n",
        );
    }

    const {
        userId,
        payload,
        isAborted,
    } = authResult;
    if (isAborted) {
        next();
        return;
    }

    req.auth.id = userId;
    req.auth.metadata = payload;
    next();
};
