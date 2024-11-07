"use strict";

const {
    useClient,
} = require("../../clients/discord");

const {
    Events,
} = require("discord.js");

const {
    registerCommands,
} = require("./interaction_create/commands");

const triggers = {
    [Events.ClientReady]: require("./client_ready"),
    [Events.InteractionCreate]: require("./interaction_create"),
    [Events.MessageCreate]: require("./message_create"),
};

exports.prepare = async () => {
    await registerCommands();
};

exports.listen = async () => {
    const client = useClient();
    const triggerEntries = Object.entries(triggers);
    for (const [key, trigger] of triggerEntries) {
        client.on(key, trigger);
    }
};
