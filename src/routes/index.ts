
// Routers
export const routerFiles = [
    "./swagger.ts",
    "./line.ts",
];

import swagger from "./swagger.ts";
import line from "./line.ts";

const routers: Record<string, () => void | Promise<void>> = {
    "./swagger.ts": swagger,
    "./line.ts": line,
};

// Load routes
export const load = async () => {
    // We can iterate routerFiles and dynamically import if we want, or just static import as above.
    // Static import is safer for bundlers/TS.
    for (const file of routerFiles) {
        if (routers[file]) {
            await Promise.resolve(routers[file]());
        }
    }
};
