import type { Platform } from "../types.ts";

export interface PlatformAdapter {
    readonly platform: Platform;
    prepare(): Promise<void>;
    listen(): void | Promise<void>;
}
