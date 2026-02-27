
// Routers
export const routerFiles = [
    "./swagger.ts",
    "./line.ts",
];

import swagger from "./swagger.ts";
import line from "./line.ts";

const routers: Record<string, () => void> = {
    "./swagger.ts": swagger,
    "./line.ts": line,
};

// Load routes
export const load = () => {
    // We can iterate routerFiles and dynamically import if we want, or just static import as above.
    // Static import is safer for bundlers/TS.
    routerFiles.forEach(file => {
        if (routers[file]) {
            routers[file]();
        }
    });
};
