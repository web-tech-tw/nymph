import { nanoid } from "nanoid";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const RECEIVED_DIR = "./received";

export async function saveReceivedImage(
    data: ArrayBuffer | Uint8Array | Buffer | Blob | Response,
): Promise<string> {
    const id = nanoid();
    await mkdir(RECEIVED_DIR, { recursive: true });
    const targetPath = join(RECEIVED_DIR, id);

    if (data instanceof Response) {
        const arrayBuffer = await data.arrayBuffer();
        await Bun.write(targetPath, arrayBuffer);
    } else {
        await Bun.write(targetPath, data);
    }

    return id;
}

export async function readReceivedImage(id: string): Promise<Uint8Array | null> {
    const filePath = join(RECEIVED_DIR, id);
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
        return null;
    }
    return await file.bytes();
}

