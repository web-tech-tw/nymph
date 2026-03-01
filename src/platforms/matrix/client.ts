import { envRequired } from "../../config/index.ts";
import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import { MatrixAccess } from "../../database/models/matrix-access.ts";

const homeserverUrl = envRequired("MATRIX_HOMESERVER");
const username = envRequired("MATRIX_USERNAME");
const password = envRequired("MATRIX_PASSWORD");
const deviceName = "Nymph";

const storage = new SimpleFsStorageProvider("data/storage.json");
const crypto = new RustSdkCryptoStorageProvider("data/crypto");

async function createClient(): Promise<MatrixClient> {
    const existing = await MatrixAccess.findOne({ username });
    if (existing) {
        return new MatrixClient(homeserverUrl, existing.accessToken, storage, crypto);
    }

    const auth = new MatrixAuth(homeserverUrl);
    const { accessToken } = await auth.passwordLogin(username, password, deviceName);
    await new MatrixAccess({ username, accessToken }).save();
    return new MatrixClient(homeserverUrl, accessToken, storage, crypto);
}

let _client: MatrixClient | undefined;

export async function useMatrixClient(refresh = false): Promise<MatrixClient> {
    if (!refresh && _client) return _client;
    _client = await createClient();
    return _client;
}

let _userId: string | undefined;

export async function fetchMatrixUserId(client: MatrixClient, refresh = false): Promise<string> {
    if (!refresh && _userId) return _userId;
    _userId = await client.getUserId();
    return _userId;
}

export async function startMatrixSync(): Promise<void> {
    if (!_client) throw new Error("Matrix client not initialised");
    const rooms = await _client.getJoinedRooms();
    await _client.crypto.prepare(rooms);
    AutojoinRoomsMixin.setupOnClient(_client);
    await _client.start();
}
