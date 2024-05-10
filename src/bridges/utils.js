"use strict";

const relayMap = require("../../relay.json");

exports.find = (key, value) =>
    relayMap.find((i) => i[key] === value);
