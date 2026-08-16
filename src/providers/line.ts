import { PlatformName } from "../types/platform";
import type {
    BaseProvider,
    ChatContext,
} from "../types/platform";

export class LineProvider implements BaseProvider {
    readonly name: PlatformName = PlatformName.Discord;

    constructor() {
    }

    async isEnabled(): Promise<boolean> {
        return false;
    }

    async start(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async stop(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async onMessage(_ctx: ChatContext): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async onCommand(_command: string, _args: string[], _ctx: ChatContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
}