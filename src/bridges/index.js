"use strict";

const finder = require("./finder");
const sender = require("./sender");

exports.hasRelay = (platform, roomId) => {
    return !!finder(platform, roomId);
};

exports.relayText = (platform, roomId, text, name) => {
    const recipients = finder(platform, roomId);
    if (!recipients) {
        return;
    }
    text = `${name} ⬗ ${platform}\n${text}`;
    sender.broadcast(platform, recipients, text, false);
};

exports.sendText = (platform, roomId, text, included=false) => {
    const recipients = finder(platform, roomId);
    if (recipients) {
        sender.broadcast(platform, recipients, text, included);
    } else {
        sender.send(platform, roomId, text);
    }
};
