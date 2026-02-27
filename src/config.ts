/**
 * Check is production mode.
 * @module config
 * @function
 * @return {boolean} true if production
 */
export function isProduction(): boolean {
    return getMust("NODE_ENV") === "production";
}

/**
 * Get environment overview.
 * @module config
 * @function
 * @return {object}
 */
export function getEnvironmentOverview(): {node: string, runtime: string} {
    return {
        node: getFallback("NODE_ENV", "development"),
        runtime: getFallback("RUNTIME_ENV", "native"),
    };
}

/**
 * Shortcut to get config value.
 * @module config
 * @function
 * @param {string} key the key
 * @return {string} the value
 */
export function get(key: string): string | undefined {
    return process.env[key];
}

/**
 * Get the bool value from config, if yes, returns true.
 * @module config
 * @function
 * @param {string} key the key
 * @return {bool} the bool value
 */
export function getEnabled(key: string): boolean {
    return getMust(key) === "yes";
}

/**
 * Get the array value from config.
 * @module config
 * @function
 * @param {string} key the key
 * @param {string} [separator=,] the separator.
 * @return {array} the array value
 */
export function getSplited(key: string, separator: string = ","): string[] {
    return getMust(key).
        split(separator).
        filter((s) => s).
        map((s) => s.trim());
}

/**
 * Get the value from config with error thrown.
 * @module config
 * @function
 * @param {string} key the key
 * @return {string} the expected value
 * @throws {Error} if value is undefined, throw an error
 */
export function getMust(key: string): string {
    const value = get(key);
    if (value === undefined) {
        throw new Error(`config key ${key} is undefined`);
    }
    return value;
}

/**
 * Get the value from config with fallback.
 * @module config
 * @function
 * @param {string} key the key
 * @param {string} fallback the fallback value
 * @return {string} the expected value
 */
export function getFallback(key: string, fallback: string): string {
    return get(key) || fallback;
}
