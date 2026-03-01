import { envRequired } from "../../config/index.ts";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { useCache } from "../cache.ts";
import { usePublicKey } from "../keypair.ts";
import type { TokenValidationResult, AuthMetadata } from "../../types.ts";

const issuerIdentity = "Sara Hoshikawa";

const client = axios.create({
    baseURL: envRequired("SARA_RECV_HOST"),
    headers: { "User-Agent": "sara_client/2.0" },
});

const verifyOptions = {
    algorithms: ["ES256"] as jwt.Algorithm[],
    issuer: issuerIdentity,
    audience: envRequired("SARA_AUDIENCE_URL"),
    complete: true,
};

interface SaraJwtPayload {
    sub: string;
    jti: string;
    user: Record<string, unknown>;
}

async function isActivated(tokenId: string): Promise<boolean> {
    const cache = useCache();
    const key = `sara_token:${tokenId}`;
    if (cache.has(key)) return cache.get<boolean>(key)!;

    const result = await client.head(`/tokens/${tokenId}`, {
        validateStatus: (s) => s === StatusCodes.OK || s === StatusCodes.NOT_FOUND,
    });

    const activated = result.status === StatusCodes.OK;
    cache.set(key, activated, 300);
    return activated;
}

export async function validate(token: string): Promise<TokenValidationResult> {
    const result: TokenValidationResult = { userId: null, payload: null, isAborted: false };
    try {
        const publicKey = usePublicKey();
        const { payload } = jwt.verify(token, publicKey, verifyOptions) as {
            payload: SaraJwtPayload;
        };

        if (!(await isActivated(payload.jti))) {
            throw new Error("sara_token is not activated");
        }

        result.userId = payload.sub;
        result.payload = { profile: payload.user } satisfies AuthMetadata;
    } catch (e) {
        result.isAborted = true;
        result.payload = e instanceof Error ? { error: e.message } : null;
    }
    return result;
}
