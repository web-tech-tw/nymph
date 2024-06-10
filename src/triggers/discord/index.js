"use strict";

const {
    useClient,
} = require("../../clients/discord");

const {
    registerCommands,
} = require("./interaction_create/commands");

exports.startListen = async () => {
    const client = await useClient();

    const triggers = {
        interactionCreate: require("./interaction_create"),
        messageCreate: require("./message_create"),
    };
    for (const [key, trigger] of Object.entries(triggers)) {
        client.on(key, trigger);
    }

    await registerCommands();
};
