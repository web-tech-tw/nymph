"use strict";
// Matrix is an opensource instant messaging platform.

const {
    createClient,
    MatrixClient,
} = require("matrix-js-sdk");

const {
    MATRIX_HOMESERVER: homeserverUrl,
    MATRIX_USERNAME: username,
    MATRIX_ACCESS_TOKEN: accessToken,
} = process.env;

const newClient = () => {
    const client = createClient({
        baseUrl: homeserverUrl,
        userId: username,
        accessToken,
    });
    return client;
};

let client;
/**
 * Use Matrix client
 *
 * @param {boolean} cached - Use the cached client
 * @return {MatrixClient} - The client
 */
exports.useClient = (cached = true) => {
    if (cached && client) {
        return client;
    }
    client = newClient();
    return client;
};
