import { readFileSync } from "node:fs";
import { PUBLIC_KEY_FILENAME } from "./const.ts";

export const usePublicKey = () => readFileSync(PUBLIC_KEY_FILENAME);
