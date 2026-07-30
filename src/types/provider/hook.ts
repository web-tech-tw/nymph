import type { Router } from "express";
import type { BaseProvider } from "./index.ts";

export interface HookProvider extends BaseProvider {
    router: Router;
}
