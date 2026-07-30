import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { SendProvider, SendTextParameters } from "../../types/provider/send.ts";
import { chatWithAI } from "../../agents/chat.ts";

export class AnthropicSend extends ProviderBase implements SendProvider {
    public get type(): ProviderType {
        return "anthropic";
    }

    public async ensure(): Promise<void> {
        // Initialization check
    }

    public async text({ chatId, text }: SendTextParameters): Promise<void> {
        if (!this.enabled) return;
        await chatWithAI(chatId, text);
    }
}

export default AnthropicSend;
