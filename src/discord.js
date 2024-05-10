"use strict";

const {
    ActivityType,
    Events,
    PresenceUpdateStatus,
} = require("discord.js");

const {
    useClient,
} = require("./clients/discord");

const {
    startListen,
} = require("./triggers/discord");

module.exports = async () => {
    const client = useClient();

    client.on(Events.ClientReady, () => {
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
        startListen();

        setInterval(
            setupStatusMessage,
            (86400 - 3600) * 1000,
        );
    });
};
