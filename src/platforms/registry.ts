import type { PlatformAdapter } from "./types.ts";

const adapters: PlatformAdapter[] = [];

export function registerPlatform(adapter: PlatformAdapter): void {
    adapters.push(adapter);
}

export async function prepareAll(): Promise<void> {
    await Promise.all(adapters.map((a) => a.prepare()));
}

export function listenAll(): void {
    for (const a of adapters) a.listen();
}

export function getAdapters(): readonly PlatformAdapter[] {
    return adapters;
}
