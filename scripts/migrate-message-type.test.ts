import { describe, it, expect, mock } from "bun:test";
import { parseMessageContent, migrateMessageTypes } from "./migrate-message-type";
import type mongoose from "mongoose";

describe("Message Type Migration", () => {
    describe("parseMessageContent", () => {
        it("should parse standard text message as type 'text'", () => {
            const result = parseMessageContent("Hello world");
            expect(result).toEqual({
                type: "text",
                content: "Hello world",
            });
        });

        it("should parse [image:id] tag and extract image ID with type 'image'", () => {
            const result = parseMessageContent("[image:V1StGXR8_Z5jdHi6B-myT]");
            expect(result).toEqual({
                type: "image",
                content: "V1StGXR8_Z5jdHi6B-myT",
            });
        });

        it("should handle [image:id] with surrounding whitespace in id or tag", () => {
            const result = parseMessageContent("  [image:custom_img_id_123]  ");
            expect(result).toEqual({
                type: "image",
                content: "custom_img_id_123",
            });
        });

        it("should treat message containing [image:id] in the middle of a sentence as text", () => {
            const result = parseMessageContent("Please check [image:123] in this link");
            expect(result).toEqual({
                type: "text",
                content: "Please check [image:123] in this link",
            });
        });

        it("should preserve multiline text if not an image tag", () => {
            const multiline = "Line 1\nLine 2\nLine 3";
            const result = parseMessageContent(multiline);
            expect(result).toEqual({
                type: "text",
                content: multiline,
            });
        });
    });

    describe("migrateMessageTypes with mock MongoDB db", () => {
        it("should execute bulk updates for image messages and backfill text messages", async () => {
            const mockImageDocs = [
                {
                    _id: "doc1",
                    content: "[image:img_abc_123]",
                },
                {
                    _id: "doc2",
                    content: "[image:img_def_456]",
                },
            ];

            let bulkWriteCalls: unknown[] = [];
            const updateManyCalls: unknown[] = [];

            const mockCollection = {
                find: mock(() => ({
                    toArray: mock(async () => mockImageDocs),
                })),
                bulkWrite: mock(async (ops: unknown[]) => {
                    bulkWriteCalls = ops;
                    return { ok: 1 };
                }),
                updateMany: mock(async (filter: unknown, update: unknown) => {
                    updateManyCalls.push({ filter, update });
                    return { modifiedCount: 5 };
                }),
            };

            const mockDb = {
                collection: mock(() => mockCollection),
            } as unknown as mongoose.mongo.Db;

            const result = await migrateMessageTypes(mockDb);

            expect(mockDb.collection).toHaveBeenCalledWith("chatmessages");
            expect(result.imageMessagesUpdated).toBe(2);
            expect(result.textMessagesUpdated).toBe(5);

            expect(bulkWriteCalls.length).toBe(2);
            expect(bulkWriteCalls[0]).toEqual({
                updateOne: {
                    filter: { _id: "doc1" },
                    update: {
                        $set: {
                            type: "image",
                            content: "img_abc_123",
                        },
                    },
                },
            });
            expect(bulkWriteCalls[1]).toEqual({
                updateOne: {
                    filter: { _id: "doc2" },
                    update: {
                        $set: {
                            type: "image",
                            content: "img_def_456",
                        },
                    },
                },
            });

            expect(updateManyCalls.length).toBe(1);
            expect(updateManyCalls[0]).toEqual({
                filter: {
                    $or: [
                        { type: { $exists: false } },
                        { type: null },
                        { type: { $nin: ["text", "image"] } },
                    ],
                },
                update: {
                    $set: {
                        type: "text",
                    },
                },
            });
        });

        it("should handle empty image list gracefully", async () => {
            const mockCollection = {
                find: mock(() => ({
                    toArray: mock(async () => []),
                })),
                bulkWrite: mock(async () => ({ ok: 1 })),
                updateMany: mock(async () => ({ modifiedCount: 0 })),
            };

            const mockDb = {
                collection: mock(() => mockCollection),
            } as unknown as mongoose.mongo.Db;

            const result = await migrateMessageTypes(mockDb);
            expect(result.imageMessagesUpdated).toBe(0);
            expect(result.textMessagesUpdated).toBe(0);
            expect(mockCollection.bulkWrite).not.toHaveBeenCalled();
        });
    });
});
