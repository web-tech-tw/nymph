import { readFileSync } from "node:fs";
import { PUBLIC_KEY_FILENAME } from "../constants.ts";

export function usePublicKey(): Buffer {
    return readFileSync(PUBLIC_KEY_FILENAME);
}
