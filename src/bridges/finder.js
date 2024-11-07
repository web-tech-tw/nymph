"use strict";

const relayMap = require("../../relay.json");

/**
 * Find a relay by key and value.
 *
 * @param {string} key - The key to search.
 * @param {string} value - The value to search.
 * @return {object} The relay.
 */
module.exports = (key, value) =>{
    const itemMatch = (i) => i[key] === value;
    return relayMap.find(itemMatch);
};
