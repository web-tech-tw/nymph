"use strict";

const {
    useClient,
} = require("../../clients/matrix");

exports.startListen = async () => {
    const client = await useClient();

    const triggers = {
        "room.failed_decryption": require("./room/failed_decryption"),
        "room.message": require("./room/message"),
    };
    for (const [key, trigger] of Object.entries(triggers)) {
        client.on(key, trigger);
    }
};
