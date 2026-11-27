import { describe, test, expect } from "bun:test";
import { SessionQueue, SessionQueueFullError } from "./session-queue";

describe("SessionQueue", () => {
    test("should serialize tasks within the same session", async () => {
        const queue = new SessionQueue();
        const order: string[] = [];

        const t1 = queue.enqueue("discord:room1", async () => {
            order.push("start-1");
            await new Promise((r) => setTimeout(r, 30));
            order.push("end-1");
            return 1;
        });

        const t2 = queue.enqueue("discord:room1", async () => {
            order.push("start-2");
            order.push("end-2");
            return 2;
        });

        const results = await Promise.all([t1, t2]);
        expect(results).toEqual([1, 2]);
        expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);
        expect(queue.getPendingCount("discord:room1")).toBe(0);
    });

    test("should allow concurrent execution across different sessions", async () => {
        const queue = new SessionQueue();
        const started: string[] = [];

        const t1 = queue.enqueue("discord:roomA", async () => {
            started.push("A");
            await new Promise((r) => setTimeout(r, 30));
        });

        const t2 = queue.enqueue("discord:roomB", async () => {
            started.push("B");
        });

        await Promise.all([t1, t2]);
        expect(started).toEqual(["A", "B"]);
    });

    test("should throw SessionQueueFullError when exceeding maxPending", async () => {
        const queue = new SessionQueue({ maxPending: 2 });

        let releaseFirst!: () => void;
        const firstDone = new Promise<void>((r) => {
            releaseFirst = r;
        });

        const t1 = queue.enqueue("discord:busy", async () => {
            await firstDone;
        });
        const t2 = queue.enqueue("discord:busy", async () => "second");

        await expect(queue.enqueue("discord:busy", async () => "third")).rejects.toBeInstanceOf(
            SessionQueueFullError,
        );

        releaseFirst();
        await Promise.all([t1, t2]);
        expect(queue.getPendingCount("discord:busy")).toBe(0);
    });

    test("should recover queue after a task throws", async () => {
        const queue = new SessionQueue();

        const t1 = queue.enqueue("discord:err", async () => {
            throw new Error("boom");
        });
        const t2 = queue.enqueue("discord:err", async () => "recovered");

        await expect(t1).rejects.toThrow("boom");
        expect(await t2).toBe("recovered");
        expect(queue.getPendingCount("discord:err")).toBe(0);
    });
});
