import { getEnvironmentOverview, env } from "../config/index.ts";
import { APP_NAME } from "../constants.ts";
import { connectDatabase } from "../database/connection.ts";
import { registerPlatform, prepareAll, listenAll } from "../platforms/registry.ts";
import { useApp } from "../http/app.ts";
import { loadRoutes } from "../http/routes/index.ts";
import { startServer } from "./server.ts";

export async function bootstrap(): Promise<void> {
    const app = useApp();

    app.get("/", (_, res) => res.render("index"));
    app.get("/robots.txt", (_, res) => res.type("txt").send("User-agent: *\nDisallow: /"));

    await loadRoutes();

    if (env("DISCORD_BOT_TOKEN")) {
        const { discordAdapter } = await import("../platforms/discord/handlers.ts");
        registerPlatform(discordAdapter);
    }
    if (env("LINE_CHANNEL_ACCESS_TOKEN")) {
        const { lineAdapter } = await import("../platforms/line/handlers.ts");
        registerPlatform(lineAdapter);
    }
    if (env("MATRIX_PASSWORD")) {
        const { matrixAdapter } = await import("../platforms/matrix/handlers.ts");
        registerPlatform(matrixAdapter);
    }

    await connectDatabase();
    await prepareAll();

    const { node, runtime } = getEnvironmentOverview();
    console.info(`${APP_NAME} (environment: ${node}, ${runtime})\n====`);

    startServer(app, ({ protocol, hostname, port }) => {
        console.info(`${protocol}://${hostname}:${port}`);
    });

    listenAll();
}
