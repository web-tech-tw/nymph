"use strict";

require("dotenv").config();

const {
    ActivityType,
    Events,
    PresenceUpdateStatus,
} = require("discord.js");

const {
    useClient,
} = require("./src/clients/discord");

const {
    startListen,
} = require("./src/triggers/discord");

const client = useClient();
client.on(Events.ClientReady, () => {
    const showStartupMessage = async () => {
        console.info(
            "Nymph 系統 已啟動",
            `身份：${client.user.tag}`,
        );
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
