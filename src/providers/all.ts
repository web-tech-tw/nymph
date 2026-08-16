import { PlatformName } from "../types/platform";
import type {
    BaseProvider,
    ChatContext,
} from "../types/platform";

export class AllProvider implements BaseProvider {
    readonly name: PlatformName = PlatformName.All;
    readonly #providers: BaseProvider[];

    constructor(providers: BaseProvider[]) {
        this.#providers = providers;
    }

    async isEnabled(): Promise<boolean> {
        const results = await Promise.all(this.#providers.map(
            (provider) => provider.isEnabled()
        ));
        return results.every((result) => result);
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

    async onMessage(ctx: ChatContext): Promise<void> {
        await Promise.all(this.#providers.map(
            (provider) => provider.onMessage(ctx),
        ));
    }

    async onCommand(command: string, args: string[], ctx: ChatContext): Promise<void> {
        await Promise.all(this.#providers.map(
            (provider) => provider.onCommand(command, args, ctx),
        ));
    }
}
