"use strict";

const {useClient} = require("../core/discord.js");

const client = useClient();

exports.startListen = () => {
    const triggers = {
        interactionCreate: require("./interaction_create/index.js"),
        messageCreate: require("./message_create/index.js"),
    };
    for (const [key, trigger] of Object.entries(triggers)) {
        client.on(key, trigger);
    }
};
