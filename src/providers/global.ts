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

    async sendText(roomId: string, content: string, platformName?: PlatformName): Promise<void> {
        await Promise.all(this.#providers.filter((p) => (
            platformName ? platformName === p.name : true
        )).map((provider) => (
            provider.sendText(roomId, content)
        )));
    }
}
