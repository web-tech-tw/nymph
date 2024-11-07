"use strict";

const {getMust} = require("../config");

const {
    PLATFORM_LINE,
    PLATFORM_MATRIX,
    PLATFORM_DISCORD,
} = require("./const");

exports.isEnabled = {
    [PLATFORM_LINE]: !!getMust("LINE_CHANNEL_ACCESS_TOKEN"),
    [PLATFORM_MATRIX]: !!getMust("MATRIX_PASSWORD"),
    [PLATFORM_DISCORD]: !!getMust("DISCORD_BOT_TOKEN"),
};

exports.listeners = {
    [PLATFORM_LINE]: require("../listeners/line"),
    [PLATFORM_MATRIX]: require("../listeners/matrix"),
    [PLATFORM_DISCORD]: require("../listeners/discord"),
};

exports.prepare = () => {
    for (const platform of Object.keys(exports.isEnabled)) {
        if (exports.isEnabled[platform]) {
            exports.listeners[platform].prepare();
        }
    }
};

exports.listen = () => {
    for (const platform of Object.keys(exports.isEnabled)) {
        if (exports.isEnabled[platform]) {
            exports.listeners[platform].listen();
        }
    }
};
