import { PlatformName } from "../types/provider";
import type {
    BasePlatformProvider,
    MessageCallback,
    CommandCallback
} from "../types/provider";

export interface LineProviderParams {
    token: string;
}

export class LineProvider implements BasePlatformProvider {
    readonly name: PlatformName = PlatformName.LINE;
    readonly enabled: boolean;

    constructor(params: LineProviderParams) {
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