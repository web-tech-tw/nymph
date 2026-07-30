// Nymph – Messenger Bridge & AI Platform Entry Point

import { appConfig, httpConfig } from "./src/config.ts";
import { app, indexHandler, heartHandler } from "./src/server.ts";

import DiscordSend from "./src/providers/discord/send.ts";
import DiscordListen from "./src/providers/discord/listen.ts";

import MatrixSend from "./src/providers/matrix/send.ts";
import MatrixListen from "./src/providers/matrix/listen.ts";

import LINESend from "./src/providers/line/send.ts";
import LINEHook from "./src/providers/line/hook.ts";

import AnthropicSend from "./src/providers/anthropic/send.ts";

import {
    hookRouter,
    registerSendProviders,
    registerListenProviders,
    registerHookProviders,
} from "./src/registry.ts";

// Register all send providers
await registerSendProviders([
    new LINESend(),
    new MatrixSend(),
    new DiscordSend(),
    new AnthropicSend(),
]);

// Register all listen providers
await registerListenProviders([
    new MatrixListen(),
    new DiscordListen(),
]);

// Register all hook providers
await registerHookProviders([
    new LINEHook(),
]);

// Routes
app.get("/", indexHandler);
app.get("/heart", heartHandler);
app.use("/hooks", hookRouter);

const { bindHost, bindPort } = httpConfig();
const { deviceName } = appConfig();

app.listen(bindPort, bindHost, () => {
    console.info(deviceName);
    console.info("===");
    console.info("A simple bridge and AI bot platform for every messenger.");
    console.info(`Listening on http://${bindHost}:${bindPort}`);
});
