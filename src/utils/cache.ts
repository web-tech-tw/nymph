import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 100 });

export function useCache(): NodeCache {
    return cache;
}
