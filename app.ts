import { Chat } from "./src/agents/chat";
import { GlobalProvider } from "./src/providers/global";
import type { ChatContext } from "./src/types/provider";

const settingFile = Bun.file("./setting.xml");
const chatAgnt = new Chat({
    model: Bun.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    systemPrompt: await settingFile.text()
});

const provider = new GlobalProvider([]);
provider.onMessage(async (ctx: ChatContext) => {
    const reply = await chatAgnt.replyMessage(ctx);
    await provider.sendText(ctx.platformName, ctx.roomId, reply);
});

provider.onCommand(async (_command, _args, ctx) => {
    await provider.sendText(ctx.platformName, ctx.roomId, "Not implemented");
});

provider.start();
