import { bridgeProviderConfig, type ProviderType } from "../../config.ts";

export type { ProviderType };

export const providers: Record<ProviderType, string> = {
    line: "LINE",
    matrix: "Matrix",
    discord: "Discord",
    anthropic: "Anthropic",
};

export interface BaseProvider {
    type: ProviderType;
    name: string;
    enabled: boolean;
}

export class ProviderBase implements BaseProvider {
    public get type(): ProviderType {
        throw new Error("Not implemented");
    }

    public get name(): string {
        return providers[this.type] ?? this.type;
    }

    public get enabled(): boolean {
        const configs = bridgeProviderConfig();
        const cfg = configs[this.type];
        return cfg?.enable ?? false;
    }
}
