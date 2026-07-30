import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { SendProvider, SendTextParameters } from "../../types/provider/send.ts";
import { useLineClient } from "./client.ts";

export class LINESend extends ProviderBase implements SendProvider {
    public get type(): ProviderType {
        return "line";
    }

    public async ensure(): Promise<void> {
        if (this.enabled) {
            useLineClient();
        }
    }

    public async text({ chatId, text, sender }: SendTextParameters): Promise<void> {
        if (!this.enabled) return;
        const client = useLineClient();
        const content = sender?.name ? `${sender.name} ⬗ LINE\n${text}` : text;
        await client.pushMessage({
            to: chatId,
            messages: [{ type: "text", text: content }],
        });
    }
}

export default LINESend;
