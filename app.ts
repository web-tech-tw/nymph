import { Chat } from "./src/agents/chat";
import { GlobalProvider } from "./src/providers/global";
import { DiscordProvider } from "./src/providers/discord";
import { LineProvider } from "./src/providers/line";
import type { ChatContext } from "./src/types/provider";

const settingFile = Bun.file("./setting.xml");
const chatAgnt = new Chat({
    model: Bun.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    systemPrompt: await settingFile.text()
});

const providers = [
    new DiscordProvider({
        token: Bun.env.DISCORD_TOKEN || "",
    }),
    new LineProvider({
        token: Bun.env.LINE_TOKEN || "",
    }),
];

const provider = new GlobalProvider(providers);
provider.onMessage(async (ctx: ChatContext) => {
    const reply = await chatAgnt.replyMessage(ctx);
    await provider.sendText(ctx.platformName, ctx.roomId, reply);
});

provider.onCommand(async (_command, _args, ctx) => {
    await provider.sendText(ctx.platformName, ctx.roomId, "Not implemented");
});

provider.start();
