import { Events, PresenceUpdateStatus, ActivityType, type Message } from "discord.js";
import { ProviderBase, type ProviderType } from "../../types/provider/index.ts";
import type { ListenProvider } from "../../types/provider/listen.ts";
import { useDiscordClient } from "./client.ts";
import { COMMAND_PREFIX } from "../../constants.ts";
import { chatWithAI, sliceContent } from "../../agents/chat.ts";
import { sendText } from "../../registry.ts";

export class DiscordListen extends ProviderBase implements ListenProvider {
    public get type(): ProviderType {
        return "discord";
    }

    public async listen(): Promise<void> {
        if (!this.enabled) return;
        const client = useDiscordClient();

        client.on(Events.ClientReady, () => {
            console.info(`[DiscordListen]: Logged in as ${client.user?.tag}`);
            client.user?.setPresence({
                status: PresenceUpdateStatus.Online,
                activities: [{ type: ActivityType.Playing, name: "Nymph Bot" }],
            });
        });

        client.on(Events.MessageCreate, async (message: Message) => {
            if (message.author.bot) return;
            const content = message.content.startsWith(COMMAND_PREFIX)
                ? message.content.slice(COMMAND_PREFIX.length).trim()
                : message.content;

            if (content && (message.content.startsWith(COMMAND_PREFIX) || message.mentions.users.has(client.user?.id ?? ""))) {
                try {
                    const reply = await chatWithAI(message.channel.id, content);
                    if (reply?.trim()) {
                        for (const s of sliceContent(reply.trim(), 2000)) {
                            await sendText("discord", message.channel.id, s);
                        }
                    }
                } catch (err) {
                    console.error("[DiscordListen]: Chat Error:", err);
                }
            }
        });

        console.info("[DiscordListen]: Listener initialized");
    }
}

export default DiscordListen;
