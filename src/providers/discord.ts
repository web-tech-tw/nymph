import { PlatformName } from "../types/provider";
import type {
    BasePlatformProvider,
    MessageCallback,
    CommandCallback
} from "../types/provider";

export interface DiscordProviderParams {
    token: string;
}

export class DiscordProvider implements BasePlatformProvider {
    readonly name: PlatformName = PlatformName.Discord;
    readonly enabled: boolean;

    constructor(params: DiscordProviderParams) {
        this.enabled = params.token !== "";
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

    async sendText(_roomId: string, _content: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}