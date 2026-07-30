import mountLineRoutes from "./line-webhook.ts";
import mountSwaggerRoutes from "./swagger.ts";

const mounts: Array<() => void | Promise<void>> = [
    mountSwaggerRoutes,
    mountLineRoutes,
];

export async function loadRoutes(): Promise<void> {
    for (const mount of mounts) {
        await Promise.resolve(mount());
    }
}
