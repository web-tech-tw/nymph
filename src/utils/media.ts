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

/**
 * Detects MIME media type from image byte signatures (magic numbers).
 */
export function detectImageMediaType(bytes: Uint8Array): string {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return "image/png";
    }
    if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return "image/gif";
    }
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return "image/webp";
    }
    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return "image/bmp";
    }
    return "image/jpeg";
}


