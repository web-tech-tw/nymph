// Token utils of Sara.

// Import config
import { getMust } from "../config.ts";

// Import modules
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import * as jwt from "jsonwebtoken";

import { useCache } from "../init/cache.ts";
import { usePublicKey } from "../init/keypair.ts";

// Define Sara Token specs
const issuerIdentity = "Sara Hoshikawa"; // The code of Sara v3

// Define client
export const client = axios.create({
    baseURL: getMust("SARA_RECV_HOST"),
    headers: {
        "User-Agent": "sara_client/2.0",
    },
});

// Define verifyOptions
const verifyOptions = {
    algorithms: ["ES256"],
    issuer: issuerIdentity,
    audience: getMust("SARA_AUDIENCE_URL"),
    complete: true,
};

export async function isActivated(tokenId: string): Promise<boolean> {
    const queryKey = ["sara_token", tokenId].join(":");

    const cache = useCache();
    if (cache.has(queryKey)) {
        return cache.get(queryKey) as boolean;
    }

    const result = await client.head(`/tokens/${tokenId}`, {
        validateStatus: (status: number) =>
            status === StatusCodes.OK ||
            status === StatusCodes.NOT_FOUND,
    });

    const isActivated = result.status === StatusCodes.OK;
    cache.set(queryKey, isActivated, 300);
    return isActivated;
}

export interface SaraTokenAuthResult {
    userId: string | null;
    payload: any;
    isAborted: boolean;
}

export async function validate(token: string): Promise<SaraTokenAuthResult> {
    const result: SaraTokenAuthResult = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const publicKey = usePublicKey();
        const { payload } = jwt.verify(token, publicKey, verifyOptions) as any;

        if (!(await isActivated(payload.jti))) {
            throw new Error("sara_token is not activated");
        }

        result.userId = payload.sub;
        result.payload = {
            profile: payload.user,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}
