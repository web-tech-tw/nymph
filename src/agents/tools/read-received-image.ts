import { tool } from "ai";
import { z } from "zod";
import { readReceivedImage, detectImageMediaType } from "../../utils/media";

export interface ReadReceivedImageResult {
    success: boolean;
    imageId: string;
    mediaType?: string;
    imageBytes?: Uint8Array;
    message: string;
}

export type ReadReceivedImageFetcher = (
    imageId: string,
) => Promise<Uint8Array | null>;

export function toolReadReceivedImage(customFetcher?: ReadReceivedImageFetcher) {
    return tool({
        description:
            "Read and inspect the image content of a received image from local storage using its image ID (e.g. from <image id='...'> in conversation history).",
        inputSchema: z.object({
            imageId: z
                .string()
                .describe(
                    "The unique ID of the received image (e.g. '6OXbPlS60-Zpo1eZdwPAW') as found in <image id='...'> tags in conversation history.",
                ),
        }),
        execute: async ({ imageId }): Promise<ReadReceivedImageResult> => {
            const trimmedId = imageId?.trim() || "";
            if (!trimmedId) {
                return {
                    success: false,
                    imageId: "",
                    message: "Error: No imageId provided.",
                };
            }

            const fetcher = customFetcher || readReceivedImage;
            const bytes = await fetcher(trimmedId);
            if (!bytes) {
                return {
                    success: false,
                    imageId: trimmedId,
                    message: `Image with ID '${trimmedId}' was not found in received storage.`,
                };
            }

            const mediaType = detectImageMediaType(bytes);
            return {
                success: true,
                imageId: trimmedId,
                mediaType,
                imageBytes: bytes,
                message: `Successfully loaded image '${trimmedId}' (${mediaType}, ${bytes.byteLength} bytes).`,
            };
        },
        toModelOutput: ({ output }: { output: ReadReceivedImageResult }) => {
            if (!output.success || !output.imageBytes) {
                return {
                    type: "text" as const,
                    value: output.message,
                };
            }

            return {
                type: "content" as const,
                value: [
                    {
                        type: "text" as const,
                        text: output.message,
                    },
                    {
                        type: "file" as const,
                        mediaType: output.mediaType || "image/jpeg",
                        data: {
                            type: "data" as const,
                            data: output.imageBytes,
                        },
                    },
                ],
            };
        },
    });
}
