import { PlatformName } from "../types/provider";
import type {
    BaseProvider,
    MessageCallback,
    CommandCallback
} from "../types/provider";

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

    async onMessage(_cb: MessageCallback): Promise<void> {
        throw new Error("Method not implemented.");
    }

    async onCommand(_cb: CommandCallback): Promise<void> {
        throw new Error("Method not implemented.");
    }
}