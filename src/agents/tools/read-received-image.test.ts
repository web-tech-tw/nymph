import { describe, it, expect } from "bun:test";
import { toolReadReceivedImage, type ReadReceivedImageResult } from "./read-received-image";

type AnyAsyncFn = (...args: unknown[]) => Promise<unknown>;

describe("read_received_image tool", () => {
    const dummyPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    it("should return error when imageId is empty", async () => {
        const tool = toolReadReceivedImage();
        const res = (await (tool.execute as AnyAsyncFn)({ imageId: "" })) as ReadReceivedImageResult;
        expect(res.success).toBe(false);
        expect(res.message).toContain("No imageId provided");

        if (tool.toModelOutput) {
            const modelOut = await tool.toModelOutput({ output: res, toolCallId: "call_1", input: { imageId: "" } });
            expect(modelOut).toEqual({
                type: "text",
                value: res.message,
            });
        }
    });

    it("should return not found message when image does not exist", async () => {
        const mockFetcher = async () => null;
        const tool = toolReadReceivedImage(mockFetcher);
        const res = (await (tool.execute as AnyAsyncFn)({ imageId: "nonexistent-123" })) as ReadReceivedImageResult;

        expect(res.success).toBe(false);
        expect(res.imageId).toBe("nonexistent-123");
        expect(res.message).toContain("was not found");

        if (tool.toModelOutput) {
            const modelOut = await tool.toModelOutput({ output: res, toolCallId: "call_2", input: { imageId: "nonexistent-123" } });
            expect(modelOut).toEqual({
                type: "text",
                value: res.message,
            });
        }
    });

    it("should load image, detect media type, and return multi-modal file content in toModelOutput", async () => {
        const mockFetcher = async (id: string) => {
            if (id === "img-abc-123") {
                return dummyPngBytes;
            }
            return null;
        };

        const tool = toolReadReceivedImage(mockFetcher);
        const res = (await (tool.execute as AnyAsyncFn)({ imageId: "  img-abc-123  " })) as ReadReceivedImageResult;

        expect(res.success).toBe(true);
        expect(res.imageId).toBe("img-abc-123");
        expect(res.mediaType).toBe("image/png");
        expect(res.imageBytes).toEqual(dummyPngBytes);
        expect(res.message).toContain("Successfully loaded image 'img-abc-123'");

        if (tool.toModelOutput) {
            const modelOut = await tool.toModelOutput({ output: res, toolCallId: "call_3", input: { imageId: "img-abc-123" } });
            expect(modelOut.type).toBe("content");
            if (modelOut.type === "content") {
                expect(modelOut.value).toHaveLength(2);
                expect(modelOut.value[0]).toEqual({
                    type: "text",
                    text: res.message,
                });
                expect(modelOut.value[1]).toEqual({
                    type: "file",
                    mediaType: "image/png",
                    data: {
                        type: "data",
                        data: dummyPngBytes,
                    },
                });
            }
        }
    });
});
