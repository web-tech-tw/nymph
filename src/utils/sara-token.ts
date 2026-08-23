import { verify, type VerifyOptions } from "jsonwebtoken";
import { existsSync, readFileSync } from "node:fs";

// Define Sara Token specs
export const issuerIdentity = "Sara Hoshikawa"; // The code of Sara v3
export const SARA_ISSUER_IDENTITY = issuerIdentity;

export interface SaraUserData {
    _id?: string;
    id?: string;
    username?: string;
    email?: string;
    nickname?: string;
    avatar_hash?: string;
    avatar?: string;
    roles?: string[];
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export interface TokenPayload {
    user: SaraUserData;
    sub: string;
    jti: string;
    iat?: number;
    exp?: number;
    aud?: string | string[];
    iss?: string;
}

export interface SaraValidationSuccess {
    userId: string;
    payload: {
        profile: SaraUserData;
    };
    isAborted: false;
}

export interface SaraValidationFailure {
    userId: null;
    payload: unknown;
    isAborted: true;
}

export type SaraTokenValidationResult = SaraValidationSuccess | SaraValidationFailure;

// Simple in-memory cache for token activation check
const cacheStore = new Map<string, { value: boolean; expiresAt: number }>();

export function useCache() {
    return {
        has(key: string): boolean {
            const entry = cacheStore.get(key);
            if (!entry) return false;
            if (Date.now() > entry.expiresAt) {
                cacheStore.delete(key);
                return false;
            }
            return true;
        },
        get(key: string): boolean | undefined {
            const entry = cacheStore.get(key);
            if (!entry) return undefined;
            if (Date.now() > entry.expiresAt) {
                cacheStore.delete(key);
                return undefined;
            }
            return entry.value;
        },
        set(key: string, value: boolean, ttlSeconds = 300): void {
            cacheStore.set(key, {
                value,
                expiresAt: Date.now() + ttlSeconds * 1000,
            });
        },
    };
}

export function usePublicKey(): string {
    if (Bun.env.SARA_PUBLIC_KEY) {
        return Bun.env.SARA_PUBLIC_KEY.replace(/\\n/g, "\n");
    }
    if (existsSync("keypair_public.pem")) {
        return readFileSync("keypair_public.pem", "utf-8");
    }
    return "";
}

// Define verifyOptions
export const getVerifyOptions = (): VerifyOptions => ({
    algorithms: ["ES256"],
    issuer: issuerIdentity,
    audience: Bun.env.SARA_AUDIENCE_URL || "https://web-tech.tw",
    complete: true,
});

/**
 * Check if token is activated
 * @param tokenId - The token id to check.
 * @return Promise<boolean>
 */
export async function isActivated(tokenId: string): Promise<boolean> {
    const queryKey = ["sara_token", tokenId].join(":");

    const cache = useCache();
    if (cache.has(queryKey)) {
        return cache.get(queryKey) ?? false;
    }

    const recvHost = Bun.env.SARA_RECV_HOST || "https://web-tech.tw/recv/sara";

    try {
        const response = await fetch(`${recvHost}/tokens/${tokenId}`, {
            method: "HEAD",
            headers: {
                "user-agent": "sara_client/2.0",
            },
        });

        const isTokenActivated = response.status === 200;
        cache.set(queryKey, isTokenActivated, 300);
        return isTokenActivated;
    } catch {
        return false;
    }
}

/**
 * Validate token
 * @param token - The token to validate.
 * @return Promise<SaraTokenValidationResult>
 */
export async function validate(token: string): Promise<SaraTokenValidationResult> {
    const result: {
        userId: string | null;
        payload: { profile: SaraUserData } | unknown;
        isAborted: boolean;
    } = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const publicKey = usePublicKey();
        const verifyOptions = getVerifyOptions();

        const { payload } = verify(
            token,
            publicKey,
            verifyOptions,
        ) as unknown as { payload: TokenPayload };

        if (!payload?.jti || !await isActivated(payload.jti)) {
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

    return result as SaraTokenValidationResult;
}

export const validateSaraToken = validate;
