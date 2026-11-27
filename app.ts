import { connectDatabase, isDatabaseConnected } from "./src/databases/connection";
import { createChatAgent, handleChatError } from "./src/agents/chat";
import {
    getAllTools,
    closeMcpClients,
    getActiveToolRegistry,
    getMcpServerStatuses,
} from "./src/agents/tools";
import { resetChatSession } from "./src/databases/models/message";
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
    const sessionId = `${ctx.platformName}:${ctx.roomId}`;

    switch (command) {
    case "reset": {
        const ok = await resetChatSession(sessionId);
        await ctx.reply(
            ok
                ? "已開啟新話題！先前的對話脈絡已清除（歷史紀錄仍保留於資料庫中）。"
                : "⚠️ 目前無法重設對話脈絡（資料庫未連線）。",
        );
        return;
    }

    case "status": {
        const model = Bun.env.OPENAI_MODEL || "(未設定)";
        const visionModel = Bun.env.OPENAI_VISION_MODEL?.trim() || undefined;
        const dbConnected = isDatabaseConnected();
        const dbStatus = dbConnected ? "已連線" : "未連線";
        const toolCount = Object.keys(getActiveToolRegistry()).length;
        const mcpStatuses = getMcpServerStatuses();
        const mcpSummary = mcpStatuses.length > 0
            ? mcpStatuses.map((s) => `${s.name}: ${s.connected ? `已連線 (${s.toolCount} 工具)` : "離線"}`).join("、")
            : "無";
        await ctx.reply(
            [
                "Nymph 系統狀態",
                `• 模型：${model}`,
                ...(visionModel ? [`• 視覺模型：${visionModel}`] : []),
                `• 資料庫：${dbStatus}`,
                `• 可用工具數：${toolCount}`,
                `• 外部 MCP：${mcpSummary}`,
            ].join("\n"),
            {
                statusCard: {
                    model,
                    visionModel,
                    dbConnected,
                    toolCount,
                    mcpServers: mcpStatuses.map((s) => ({
                        name: s.name,
                        connected: s.connected,
                        toolCount: s.toolCount,
                    })),
                },
            },
        );
        return;
    }

    case "help": {
        await ctx.reply(
            [
                "Nymph 使用指南",
                "• 直接提問或附圖提問，我會結合社群知識庫與工具協助分析。",
                "• 貼上 arXiv 論文網址即可自動產生論文速覽。",
                "• /reset — 清除目前對話脈絡，開啟全新話題。",
                "• /status — 查看目前模型與外部 MCP 狀態。",
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
        await ctx.reply(`不支援的指令：/${command}，請輸入 /help 查看可用指令。`);
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
