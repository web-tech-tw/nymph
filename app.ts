import { anthropic } from "@ai-sdk/anthropic";
import { connectDatabase } from "./src/databases/connection";
import { Chat } from "./src/agents/chat";
import { defaultTools } from "./src/agents/tools";
import { GlobalProvider } from "./src/providers/global";
import { DiscordProvider } from "./src/providers/discord";
import { LineProvider } from "./src/providers/line";
import { server } from "./src/routes";
import type { ChatContext } from "./src/types/provider";

await connectDatabase();

const settingsFile = Bun.file("./settings.xml");
const chatAgent = new Chat({
    model: anthropic(Bun.env.ANTHROPIC_MODEL || "claude-sonnet-5"),
    systemPrompt: await settingsFile.text(),
    toolSet: defaultTools,
});

const providers = [
    new DiscordProvider({
        token: Bun.env.DISCORD_TOKEN || "",
    }),
    new LineProvider({
        token: Bun.env.LINE_TOKEN || Bun.env.LINE_CHANNEL_ACCESS_TOKEN || "",
        secret: Bun.env.LINE_SECRET || Bun.env.LINE_CHANNEL_SECRET || "",
        server,
    }),
];

const provider = new GlobalProvider(providers);

provider.onMessage(async (ctx: ChatContext) => {
    const reply = await chatAgent.replyMessage(ctx);
    await ctx.reply(reply);
});

provider.onCommand(async (_command, _args, ctx) => {
    await ctx.reply("Command is not implemented yet.");
});

await provider.start();
server.listen(Number(Bun.env.PORT || 3000));
console.info(`[Nymph] HTTP Server listening on port ${Bun.env.PORT || 3000}`);
