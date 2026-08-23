import { Elysia } from "elysia";
import { validateSaraToken, type SaraTokenValidationResult, type SaraUserData } from "../utils/sara-token";

const authMethods: Record<string, (token: string) => Promise<SaraTokenValidationResult>> = {
    "SARA": validateSaraToken,
};

export interface AuthContext {
    id: string;
    metadata: {
        profile?: SaraUserData;
        [key: string]: unknown;
    };
    method: string;
    secret: string;
}

export const authPlugin = new Elysia({ name: "auth" })
    .derive({ as: "global" }, async ({ headers }): Promise<{ auth: AuthContext | null }> => {
        const authHeader = headers["authorization"];
        if (!authHeader) return { auth: null };

        const params = authHeader.split(" ");
        if (params.length !== 2) return { auth: null };

        const [rawMethod, secret] = params;
        const method = (rawMethod || "").toUpperCase();

        const validateFn = authMethods[method];
        if (!validateFn || !secret) {
            return { auth: null };
        }

        const result = await validateFn(secret);
        if (result.isAborted || !result.userId) {
            return { auth: null };
        }

        return {
            auth: {
                id: result.userId,
                metadata: result.payload || {},
                method,
                secret,
            },
        };
    });
