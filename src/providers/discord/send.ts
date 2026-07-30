import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { SendProvider, SendTextParameters } from "../../types/provider/send.ts";
import { useDiscordClient } from "./client.ts";

export class DiscordSend extends ProviderBase implements SendProvider {
    public get type(): ProviderType {
        return "discord";
    }

    public async ensure(): Promise<void> {
        if (this.enabled) {
            useDiscordClient();
        }
    }

    public async text({ chatId, text, sender }: SendTextParameters): Promise<void> {
        if (!this.enabled) return;
        const client = useDiscordClient();
        const channel = await client.channels.fetch(chatId);
        if (channel?.isSendable()) {
            const content = sender?.name ? `${sender.name} ⬗ Discord\n${text}` : text;
            await channel.send(content);
        }
    }
}

export default DiscordSend;
