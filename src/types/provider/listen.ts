import type { BaseProvider } from "./index.ts";

export interface ListenProvider extends BaseProvider {
    listen(): Promise<void> | void;
}
