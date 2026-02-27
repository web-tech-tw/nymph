// The simple toolbox for Node.js

import crypto from "node:crypto";

/**
 * Shortcut for hasOwnProperty with safe.
 * @param srcObject
 * @param propName
 */
export function isObjectPropExists(srcObject: object, propName: string): boolean {
    return Object.hasOwn(srcObject, propName);
}

/**
 * Generate random code with length.
 * @param length length of code
 */
export function generateRandomCode(length: number): string {
    const maxValue = 10 ** length - 1;
    return crypto
        .randomInt(0, maxValue)
        .toString()
        .padStart(length, "0");
}

/**
 * Hash string into sha256 hex.
 * @param data
 */
export function sha256hex(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
}
