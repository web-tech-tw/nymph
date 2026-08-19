import { createAnthropic } from "@ai-sdk/anthropic";
import { connectDatabase } from "./src/databases/connection";
import { Chat } from "./src/agents/chat";
import { getAllTools, closeMcpClients } from "./src/agents/tools";
import { GlobalProvider } from "./src/providers/global";
import { DiscordProvider } from "./src/providers/discord";
import { LineProvider } from "./src/providers/line";
import { server } from "./src/routes";
import type { ChatContext } from "./src/types/provider";

await connectDatabase();

const anthropic = createAnthropic({
    apiKey: Bun.env.ANTHROPIC_API_KEY,
    baseURL: Bun.env.ANTHROPIC_BASE_URL,
});

const tools = await getAllTools();

const settingsFile = Bun.file("./settings.xml");
const chatAgent = new Chat({
    model: anthropic(Bun.env.ANTHROPIC_MODEL || "claude-sonnet-5"),
    instructions: await settingsFile.text(),
    toolSet: tools,
});

const providers = [
    new DiscordProvider({
        token: Bun.env.DISCORD_BOT_TOKEN || "",
    }),
    new LineProvider({
        token: Bun.env.LINE_CHANNEL_ACCESS_TOKEN || "",
        secret: Bun.env.LINE_CHANNEL_SECRET || "",
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

const port = Number(Bun.env.HTTP_PORT || 3000);
server.listen(port);
console.info(`[Nymph] HTTP Server listening on port ${port}`);

const shutdown = async () => {
    console.info("[Nymph] Shutting down...");
    await closeMcpClients();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

