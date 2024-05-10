"use strict";

const {
    RoomEvent,
} = require("matrix-js-sdk");

const {
    useClient,
} = require("../../clients/matrix");

exports.startListen = () => {
    const client = useClient();

    const triggers = {
        [RoomEvent.Timeline]: require("./room/timeline"),
    };
    for (const [key, trigger] of Object.entries(triggers)) {
        client.on(key, trigger);
    }
};
