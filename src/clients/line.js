"use strict";
// LINE is an opensource instant messaging platform.

const {getMust} = require("../config");

const {
    messagingApi,
    middleware: createMiddleware,
} = require("@line/bot-sdk");

const newClient = (config) => {
    return new messagingApi.MessagingApiClient(config);
};

const newMiddleware = (config) => {
    return createMiddleware(config);
};

/**
 * The cached client.
 * @type {messagingApi.MessagingApiClient|undefined}
 */
let client;
/**
 * Use LINE client
 *
 * @param {boolean} cached - Use the cached client
 * @return {messagingApi.MessagingApiClient} - The client
 */
exports.useClient = (cached = true) => {
    if (cached && client) {
        return client;
    }

    client = newClient({
        channelAccessToken: getMust("LINE_CHANNEL_ACCESS_TOKEN"),
        channelSecret: getMust("LINE_CHANNEL_SECRET"),
    });
    return client;
};

/**
 * The cached client.
 * @type {Function|undefined}
 */
let middleware;
/**
 * Use LINE middleware
 *
 * @param {boolean} cached - Use the cached middleware
 * @return {Function} - The middleware
 */
exports.useMiddleware = (cached = true) => {
    if (cached && middleware) {
        return middleware;
    }

    middleware = newMiddleware({
        channelAccessToken: getMust("LINE_CHANNEL_ACCESS_TOKEN"),
        channelSecret: getMust("LINE_CHANNEL_SECRET"),
    });
    return middleware;
};

/**
 * Returns the ID of the channel of a given message event.
 *
 * @param {object} event - The message event object.
 * @return {string|null} - The ID of the channel, null means unknown.
 */
exports.whereSentMessageEvent = (event) => {
    const {source: {userId, roomId, groupId}} = event;
    return groupId ?? roomId ?? userId ?? null;
};

/**
 * Returns the ID of the sender of a given message event.
 *
 * @param {object} event - The message event object.
 * @return {string|null} - The ID of the sender, null means unknown.
 */
exports.whoSentMessageEvent = (event) => {
    const {source: {userId}} = event;
    return userId ?? null;
};
