import { isProduction } from "../../config/index.ts";
import type { TokenValidationResult, AuthMetadata, UserProfile } from "../../types.ts";

const DEFAULT_FAKE_USER: UserProfile = {
    _id: "fake_user",
    nickname: "The Fake User",
    email: "the_fake_user@web-tech.tw",
    roles: [],
};

export function newProfile(): UserProfile {
    return structuredClone(DEFAULT_FAKE_USER);
}

export function issue(user?: UserProfile): string {
    if (isProduction()) throw new Error("test_token is not allowed in production");
    return Buffer.from(JSON.stringify(user ?? DEFAULT_FAKE_USER)).toString("base64");
}

export function validate(token: string): TokenValidationResult {
    if (isProduction()) throw new Error("test_token is not allowed in production");

    const result: TokenValidationResult = { userId: null, payload: null, isAborted: false };
    try {
        const profile = JSON.parse(Buffer.from(token, "base64").toString("utf-8")) as UserProfile;
        result.userId = profile._id ?? null;
        result.payload = { profile } satisfies AuthMetadata;
    } catch (e) {
        result.isAborted = true;
        result.payload = e instanceof Error ? { error: e.message } : null;
    }
    return result;
}
