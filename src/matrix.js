"use strict";

const {
    useClient,
} = require("./clients/matrix");

const {
    startListen,
} = require("./triggers/matrix");

module.exports = async () => {
    const client = useClient();
    await client.startClient({initialSyncLimit: 0});

    const showStartupMessage = () => {
        const userId = client.getUserId();
        console.info(`Matrix 身份：${userId}`);
    };

    showStartupMessage();
    startListen();
};
