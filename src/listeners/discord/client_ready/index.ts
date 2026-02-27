import { useClient } from "../../../clients/discord.ts";
import { ActivityType, PresenceUpdateStatus } from "discord.js";

export default () => {
    const client = useClient();

    const showStartupMessage = async () => {
        console.info(`Discord 身份：${client.user.tag}`);
    };

    const setupStatusMessage = async () => {
        client.user.setPresence({
            status: PresenceUpdateStatus.Online,
            activities: [{
                type: ActivityType.Playing,
                name: "黑客帝國",
            }],
        });
    };

    showStartupMessage();
    setupStatusMessage();

    setInterval(
        setupStatusMessage,
        (86400 - 3600) * 1000,
    );
};
