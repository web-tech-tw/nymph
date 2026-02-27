import { readFileSync } from "node:fs";
import { join } from "node:path";

const bridgesDir = new URL(".", import.meta.url).pathname;

const relayMapPath = join(bridgesDir, "../../relay.json");
const relayMapData = readFileSync(relayMapPath, "utf-8");
const relayMap = JSON.parse(relayMapData);

/**
 * Find a relay by key and value.
 *
 * @param {string} key - The key to search.
 * @param {string} value - The value to search.
 * @return {object|undefined} The relay.
 */
export default (key: string, value: string): any => {
    const itemMatch = (i: any) => i[key] === value;
    return (relayMap as any[]).find(itemMatch);
};
