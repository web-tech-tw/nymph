"use strict";
// Matrix is an opensource instant messaging platform.

const {
    getMust,
} = require("../config");

const {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider,
} = require("matrix-bot-sdk");

const {
    StoreType,
} = require("@matrix-org/matrix-sdk-crypto-nodejs");

const MatrixAccess = require("../models/matrix_access");

const homeserverUrl = getMust("MATRIX_HOMESERVER");
const username = getMust("MATRIX_USERNAME");
const password = getMust("MATRIX_PASSWORD");

const deviceName = "Nymph";

const storage = new SimpleFsStorageProvider(
    "data/storage.json",
);
const crypto = new RustSdkCryptoStorageProvider(
    "data/crypto",
    StoreType.Sled,
);

const newClient = async () => {
    const matrixData = await MatrixAccess.findOne({username});
    if (matrixData) {
        const {accessToken} = matrixData;
        return new MatrixClient(
            homeserverUrl,
            accessToken,
            storage,
            crypto,
        );
    }

    const auth = new MatrixAuth(homeserverUrl);
    const {
        accessToken,
    } = await auth.passwordLogin(
        username,
        password,
        deviceName,
    );

    const newAccess = new MatrixAccess({
        username,
        accessToken,
    });
    await newAccess.save();

    return new MatrixClient(
        homeserverUrl,
        accessToken,
        storage,
        crypto,
    );
};

/**
 * The cached client.
 * @type {MatrixClient|undefined}
 */
let client;
/**
 * Use Matrix client
 *
 * @param {boolean} cached - Use the cached client
 * @return {Promise<MatrixClient>} - The client
 */
exports.useClient = async (cached = true) => {
    if (cached && client) {
        return client;
    }
    client = await newClient();
    return client;
};

exports.startSync = async () => {
    const joinedRooms = await client.getJoinedRooms();
    await client.crypto.prepare(joinedRooms);
    AutojoinRoomsMixin.setupOnClient(client);
    await client.start();
};
