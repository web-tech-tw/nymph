// Token utils for testing/debugging or developing.

// Import config
import { isProduction } from "../config.ts";

const DEFAULT_FAKE_USER = {
    _id: "fake_user",
    nickname: "The Fake User",
    email: "the_fake_user@web-tech.tw",
    roles: [] as any[],
};

export function newProfile(): typeof DEFAULT_FAKE_USER {
    return structuredClone(DEFAULT_FAKE_USER);
}

export function issue(user?: any): string {
    if (isProduction()) {
        throw new Error("test_token is not allowed in production");
    }

    user = user || DEFAULT_FAKE_USER;
    return Buffer.from(JSON.stringify(user), "utf-8").toString("base64");
}

export interface TestTokenAuthResult {
    userId: string | null;
    payload: any;
    isAborted: boolean;
}

export function validate(token: string): TestTokenAuthResult {
    if (isProduction()) {
        throw new Error("test_token is not allowed in production");
    }

    const result: TestTokenAuthResult = {
        userId: null,
        payload: null,
        isAborted: false,
    };

    try {
        const profile = JSON.parse(
            Buffer.from(token, "base64").toString("utf-8"),
        );

        result.userId = profile._id;
        result.payload = {
            profile,
        };
    } catch (e) {
        result.isAborted = true;
        result.payload = e;
    }

    return result;
}
