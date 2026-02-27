/**
 * Load configs from system environment variables.
 */

// Import modules
import { join as pathJoin } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

// ESM doesn't have __dirname, need to construct it
const projectRoot = new URL("../..", import.meta.url).pathname;
const dotenvPath = pathJoin(projectRoot, ".env");

const isDotEnvFileExists = existsSync(dotenvPath);
const isCustomDefined = process.env.APP_CONFIGURED === "1";

if (!isDotEnvFileExists && !isCustomDefined) {
    console.error(
        "No '.env' file detected in app root.",
        "If you're not using dotenv file,",
        "set 'APP_CONFIGURED=1' into environment variables.",
        "\n",
    );
    throw new Error(".env not exists");
}

dotenv.config();
