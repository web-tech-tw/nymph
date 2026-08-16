import { PlatformName } from "../types/provider";
import type {
    BaseGlobalProvider,
    BasePlatformProvider,
    MessageCallback,
    CommandCallback
} from "../types/provider";

export class GlobalProvider implements BaseGlobalProvider {
    readonly name: PlatformName = PlatformName.Global;
    readonly #providers: BasePlatformProvider[];
    readonly enabled: boolean;

    constructor(providers: BasePlatformProvider[]) {
        this.#providers = providers.filter((p) => p.enabled);
        this.enabled = this.#providers.length > 0;
    }

    async start(): Promise<void> {
        await Promise.all(this.#providers.map(
            (provider) => provider.start(),
        ));
    }

    async stop(): Promise<void> {
        await Promise.all(this.#providers.map(
            (provider) => provider.stop(),
        ));
    }

    onMessage(cb: MessageCallback): void {
        this.#providers.forEach((provider) => provider.onMessage(cb));
    }

    onCommand(cb: CommandCallback): void {
        this.#providers.forEach((provider) => provider.onCommand(cb));
    }

    async sendText(platformName: PlatformName, roomId: string, content: string): Promise<void> {
        await Promise.all(this.#providers.filter((p) => (
            p.name === platformName
        )).map((provider) => (
            provider.sendText(roomId, content)
        )));
    }
}
