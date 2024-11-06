"use strict";

const finder = require("./finder");
const sender = require("./sender");

exports.relayText = (platform, roomId, text, name) => {
    const recipients = finder(platform, roomId);
    if (!recipients) {
        return;
    }
    text = `${name} ⬗ ${platform}\n${text}`;
    sender.broadcast(platform, recipients, text, true);
};

exports.useSendText = (platform, roomId) => (text) => {
    const recipients = finder(platform, roomId);
    text = `⬖ Nymph\n${text}`;
    if (recipients) {
        sender.broadcast(platform, recipients, text);
    } else {
        sender.send(platform, roomId, text);
    }
};
