"use strict";

const {
    useClient,
    startSync,
} = require("../../clients/matrix");

const triggers = {
    "room.failed_decryption": require("./room/failed_decryption"),
    "room.message": require("./room/message"),
};

exports.prepare = async () => {
    const client = await useClient();

    const showStartupMessage = async () => {
        const userId = await client.getUserId();
        console.info(`Matrix 身份：${userId}`);
    };

    await showStartupMessage();
    await startSync();
};

exports.listen = async () => {
    const client = await useClient();
    for (const [key, trigger] of Object.entries(triggers)) {
        client.on(key, trigger);
    }
};
