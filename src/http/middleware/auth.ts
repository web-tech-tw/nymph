import { isProduction } from "../../config/index.ts";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest, TokenValidationResult } from "../../types.ts";

import { validate as validateSara } from "../../utils/auth/sara-token.ts";
import { validate as validateTest } from "../../utils/auth/test-token.ts";

const authMethods: Record<string, (token: string) => Promise<TokenValidationResult> | TokenValidationResult> = {
    SARA: validateSara,
    TEST: validateTest,
};

export default async function authMiddleware(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
): Promise<void> {
    const header = req.header("authorization");
    if (!header) { next(); return; }

    const parts = header.split(" ");
    if (parts.length !== 2) { next(); return; }

    const [method, secret] = parts;
    req.auth = { id: null, method, secret, metadata: null };

    const handler = authMethods[method];
    if (!handler) { next(); return; }

    const result = await handler(secret);

    if (!isProduction()) {
        console.warn("Authentication:", method, result);
    }

    if (result.isAborted) { next(); return; }
    req.auth.id = result.userId;
    req.auth.metadata = result.payload;
    next();
}
