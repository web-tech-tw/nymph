"use strict";

const {
    useClient,
    startSync,
} = require("./clients/matrix");

const {
    startListen,
} = require("./triggers/matrix");

module.exports = async () => {
    const client = await useClient();

    const showStartupMessage = async () => {
        const userId = await client.getUserId();
        console.info(`Matrix 身份：${userId}`);
    };

    await showStartupMessage();
    await startListen();
    await startSync();
};
