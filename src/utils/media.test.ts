import { describe, it, expect, afterAll } from "bun:test";
import { saveReceivedImage, readReceivedImage, detectImageMediaType, RECEIVED_DIR } from "./media";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

describe("Media storage utilities", () => {
    const createdFiles: string[] = [];

    afterAll(() => {
        for (const file of createdFiles) {
            if (existsSync(file)) {
                unlinkSync(file);
            }
        }
    });

    it("should save buffer to ./received/<nanoid> and return nanoid", async () => {
        const dummyData = new Uint8Array([1, 2, 3, 4, 5]);
        const id = await saveReceivedImage(dummyData);
        expect(id).toBeDefined();
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);

        const filePath = join(RECEIVED_DIR, id);
        createdFiles.push(filePath);

        expect(existsSync(filePath)).toBe(true);
        const fileContent = await Bun.file(filePath).arrayBuffer();
        expect(new Uint8Array(fileContent)).toEqual(dummyData);
    });

    it("should save Response object to ./received/<nanoid>", async () => {
        const dummyText = "image-binary-data";
        const res = new Response(dummyText);
        const id = await saveReceivedImage(res);
        const filePath = join(RECEIVED_DIR, id);
        createdFiles.push(filePath);

        expect(existsSync(filePath)).toBe(true);
        const content = await Bun.file(filePath).text();
        expect(content).toBe(dummyText);
    });

    it("should read received image bytes using readReceivedImage", async () => {
        const dummyData = new Uint8Array([10, 20, 30, 40]);
        const id = await saveReceivedImage(dummyData);
        createdFiles.push(join(RECEIVED_DIR, id));

        const readBytes = await readReceivedImage(id);
        expect(readBytes).not.toBeNull();
        expect(readBytes).toEqual(dummyData);
    });

    it("should return null when reading non-existent image id", async () => {
        const nonExistent = await readReceivedImage("non-existent-id-12345");
        expect(nonExistent).toBeNull();
    });

    it("should detect various image media types from byte signatures", () => {
        // JPEG
        expect(detectImageMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
        // PNG
        expect(detectImageMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
        // GIF
        expect(detectImageMediaType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe("image/gif");
        // WEBP
        const webpBytes = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ]);
        expect(detectImageMediaType(webpBytes)).toBe("image/webp");
        // BMP
        expect(detectImageMediaType(new Uint8Array([0x42, 0x4d, 0x00, 0x00]))).toBe("image/bmp");
        // Unknown / fallback
        expect(detectImageMediaType(new Uint8Array([0x00, 0x01, 0x02]))).toBe("image/jpeg");
    });
});
