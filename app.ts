import { connectDatabase } from "./src/databases/connection";
import { createChatAgent, handleChatError } from "./src/agents/chat";
import {
    getAllTools,
    closeMcpClients,
} from "./src/agents/tools";
import { GlobalProvider } from "./src/providers/global";
import { DiscordProvider } from "./src/providers/discord";
import { LineProvider } from "./src/providers/line";
import { McpProvider } from "./src/providers/mcp";
import { startScheduledPrompts, stopScheduledPrompts } from "./src/scheduler";
import { server, registerHealthProbe } from "./src/routes";
import { SessionQueue, SessionQueueFullError } from "./src/utils/session-queue";
import type { ChatContext } from "./src/types/provider";

await connectDatabase();
await getAllTools();

const discordProvider = new DiscordProvider({
    token: Bun.env.DISCORD_BOT_TOKEN || "",
    presence: Bun.env.DISCORD_PRESENCE || "",
});
const lineProvider = new LineProvider({
    token: Bun.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    secret: Bun.env.LINE_CHANNEL_SECRET || "",
    server,
});
const mcpProvider = new McpProvider({
    server,
});

registerHealthProbe(() => ({
    providers: {
        discord: { enabled: discordProvider.enabled, ready: discordProvider.isReady() },
        line: { enabled: lineProvider.enabled },
        mcp: { enabled: mcpProvider.enabled },
    },
}));

const providers = [discordProvider, lineProvider, mcpProvider];

const provider = new GlobalProvider(providers);
const sessionQueue = new SessionQueue({
    maxPending: Number(Bun.env.SESSION_QUEUE_MAX_PENDING) || 3,
});

provider.onMessage(async (ctx: ChatContext) => {
    const sessionId = `${ctx.platformName}:${ctx.roomId}`;

    const runTurn = async () => {
        const hasImages = ctx.type === "image" || Boolean(ctx.images?.length);
        try {
            const agent = await createChatAgent({
                sessionId,
                platformName: ctx.platformName,
                hasImages,
            });
            const reply = await agent.replyMessage(ctx);
            if (reply) {
                await ctx.reply(reply, agent.lastTurnMetadata);
            }
        } catch (err: unknown) {
            console.error("[Chat] Error processing message:", err);
            let retryMetadata;
            const replyText = await handleChatError(err, ctx, async (opts) => {
                const agent = await createChatAgent({
                    sessionId,
                    platformName: ctx.platformName,
                    hasImages,
                });
                const res = await agent.replyMessage(ctx, opts);
                retryMetadata = agent.lastTurnMetadata;
                return res;
            });
            if (replyText) {
                await ctx.reply(replyText, retryMetadata).catch((sendErr) => {
                    console.error("[Chat] Failed to send error reply:", sendErr);
                });
            }
        }
    };

    try {
        await sessionQueue.enqueue(sessionId, runTurn);
    } catch (err: unknown) {
        if (err instanceof SessionQueueFullError) {
            await ctx.reply("⏳ 目前還有多則訊息正在處理中，請稍候片刻再傳送下一則。").catch((sendErr) => {
                console.error("[Chat] Failed to send queue-full reply:", sendErr);
            });
            return;
        }
        throw err;
    }
});

provider.onCommand(async (command, _args, ctx) => {
    switch (command) {
    case "help": {
        await ctx.reply(
            [
                "Nymph 使用指南",
                "• 直接提問或附圖提問，我會結合社群知識庫與工具協助分析。",
                "• 貼上 arXiv 論文網址即可自動產生論文速覽。",
                "• /help — 顯示此說明。",
            ].join("\n"),
            {
                helpCard: {
                    baseUrl: Bun.env.BASE_URL || undefined,
                },
            },
        );
        return;
    }

    default:
        await ctx.reply("請直接輸入問題即可，或輸入 /help 查看使用指南。");
    }
});

await provider.start();

// Scheduled prompts are Discord-only and configured exclusively via schedule.toml
await startScheduledPrompts(discordProvider);

const port = Number(Bun.env.HTTP_PORT || 3000);
server.listen(port);
console.info(`[Nymph] HTTP Server listening on port ${port}`);

const shutdown = async () => {
    console.info("[Nymph] Shutting down...");
    stopScheduledPrompts();
    await closeMcpClients();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
