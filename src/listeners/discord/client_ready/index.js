"use strict";

const {
    useClient,
} = require("../../../clients/discord");

const {
    ActivityType,
    PresenceUpdateStatus,
} = require("discord.js");

/**
 * @param {discord.Interaction} interaction
 * @return {void}
 */
module.exports = () => {
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
