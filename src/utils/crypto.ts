import crypto from "node:crypto";

export function randomCode(length: number): string {
    return crypto.randomInt(0, 10 ** length - 1).toString().padStart(length, "0");
}

export function sha256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
}
