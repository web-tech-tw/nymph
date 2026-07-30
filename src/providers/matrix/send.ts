import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { SendProvider, SendTextParameters } from "../../types/provider/send.ts";
import { useMatrixClient } from "./client.ts";

export class MatrixSend extends ProviderBase implements SendProvider {
    public get type(): ProviderType {
        return "matrix";
    }

    public async ensure(): Promise<void> {
        if (this.enabled) {
            await useMatrixClient();
        }
    }

    public async text({ chatId, text, sender }: SendTextParameters): Promise<void> {
        if (!this.enabled) return;
        const client = await useMatrixClient();
        const content = sender?.name ? `${sender.name} ⬗ Matrix\n${text}` : text;
        await client.sendMessage(chatId, {
            msgtype: "m.text",
            format: "plain/text",
            body: content,
        });
    }
}

export default MatrixSend;
