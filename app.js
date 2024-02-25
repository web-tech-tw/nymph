"use strict";

require("dotenv").config();

const {
    ActivityType,
    Events,
    PresenceUpdateStatus,
} = require("discord.js");

const {
    useClient,
} = require("./src/core/discord");

const triggerManager = require("./src/triggers");
const taskManager = require("./src/tasks");

const client = useClient();

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

client.on(Events.ClientReady, () => {
    showStartupMessage();
    setupStatusMessage();

    triggerManager.startListen();
    taskManager.startJobs();

    setInterval(
        setupStatusMessage,
        (86400 - 3600) * 1000,
    );
});
