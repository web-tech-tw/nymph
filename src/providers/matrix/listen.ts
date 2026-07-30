import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { ListenProvider } from "../../types/provider/listen.ts";
import { useMatrixClient, startMatrixSync } from "./client.ts";

export class MatrixListen extends ProviderBase implements ListenProvider {
    public get type(): ProviderType {
        return "matrix";
    }

    public async listen(): Promise<void> {
        if (!this.enabled) return;
        await useMatrixClient();
        await startMatrixSync();
        console.info("[MatrixListen]: Listener initialized");
    }
}

export default MatrixListen;
