// Matrix is an opensource instant messaging platform.

import { getMust } from "../config.ts";
import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import { StoreType } from "@matrix-org/matrix-sdk-crypto-nodejs";
import MatrixAccess from "../models/matrix_access.ts";

const homeserverUrl = getMust("MATRIX_HOMESERVER");
const username = getMust("MATRIX_USERNAME");
const password = getMust("MATRIX_PASSWORD");

const deviceName = "Nymph";

const storage = new SimpleFsStorageProvider("data/storage.json");
const crypto = new RustSdkCryptoStorageProvider("data/crypto", StoreType.Sled);

async function newClient() {
    const matrixData = await MatrixAccess.findOne({ username });
    if (matrixData) {
        const { accessToken } = matrixData as any;
        return new MatrixClient(homeserverUrl, accessToken, storage, crypto);
    }

    const auth = new MatrixAuth(homeserverUrl);
    const { accessToken } = await auth.passwordLogin(username, password, deviceName);

    const newAccess = new MatrixAccess({
        username,
        accessToken,
    });
    await newAccess.save();

    return new MatrixClient(homeserverUrl, accessToken, storage, crypto);
}

let client: MatrixClient | undefined;
export const useClient = async (cached = true): Promise<MatrixClient> => {
    if (cached && client) {
        return client;
    }
    client = await newClient();
    return client;
};

let userId: string | undefined;
export const fetchUserId = async (clientInstance: MatrixClient, cached = true): Promise<string> => {
    if (cached && userId) {
        return userId;
    }
    userId = await clientInstance.getUserId();
    return userId;
};

export const startSync = async () => {
    const joinedRooms = await client!.getJoinedRooms();
    await client!.crypto.prepare(joinedRooms);
    AutojoinRoomsMixin.setupOnClient(client!);
    await client!.start();
};
