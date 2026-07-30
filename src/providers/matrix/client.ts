import { bridgeProviderConfig } from "../../config.ts";
import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import { MatrixAccess } from "../../memory.ts";

function getMatrixConfig() {
    const config = bridgeProviderConfig();
    return {
        homeserverUrl: config.matrix?.homeserverUrl || process.env.MATRIX_HOMESERVER || "https://matrix.org",
        username: process.env.MATRIX_USERNAME || "",
        password: config.matrix?.accessToken || process.env.MATRIX_PASSWORD || "",
    };
}

const storage = new SimpleFsStorageProvider("data/storage.json");
const crypto = new RustSdkCryptoStorageProvider("data/crypto");

async function createClient(): Promise<MatrixClient> {
    const { homeserverUrl, username, password } = getMatrixConfig();
    const existing = await MatrixAccess.findOne({ username });
    if (existing) {
        return new MatrixClient(homeserverUrl, existing.accessToken, storage, crypto);
    }

    const auth = new MatrixAuth(homeserverUrl);
    const { accessToken } = await auth.passwordLogin(username, password, "Nymph");
    await new MatrixAccess({ username, accessToken }).save();
    return new MatrixClient(homeserverUrl, accessToken, storage, crypto);
}

let _client: MatrixClient | undefined;

export async function useMatrixClient(refresh = false): Promise<MatrixClient> {
    if (!refresh && _client) return _client;
    _client = await createClient();
    return _client;
}

export async function startMatrixSync(): Promise<void> {
    if (!_client) throw new Error("Matrix client not initialized");
    const rooms = await _client.getJoinedRooms();
    await _client.crypto.prepare(rooms);
    AutojoinRoomsMixin.setupOnClient(_client);
    await _client.start();
}
