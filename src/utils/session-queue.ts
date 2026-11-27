export interface SessionQueueOptions {
    /** Maximum number of queued tasks waiting behind the active task per session. */
    maxPending?: number;
}

export class SessionQueueFullError extends Error {
    readonly sessionId: string;
    readonly pending: number;

    constructor(sessionId: string, pending: number) {
        super(`Session queue full for ${sessionId} (${pending} pending)`);
        this.name = "SessionQueueFullError";
        this.sessionId = sessionId;
        this.pending = pending;
    }
}

interface QueueEntry {
    tail: Promise<void>;
    pending: number;
}

/**
 * Lightweight per-session FIFO task serializer.
 * Ensures messages in the same room/session are processed sequentially
 * so chat history reads/writes never race or interleave.
 */
export class SessionQueue {
    #queues = new Map<string, QueueEntry>();
    #maxPending: number;

    constructor(options: SessionQueueOptions = {}) {
        this.#maxPending = options.maxPending ?? 3;
    }

    async enqueue<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
        const existing = this.#queues.get(sessionId);
        if (existing && existing.pending >= this.#maxPending) {
            throw new SessionQueueFullError(sessionId, existing.pending);
        }

        const entry: QueueEntry = existing ?? { tail: Promise.resolve(), pending: 0 };
        entry.pending += 1;
        this.#queues.set(sessionId, entry);

        const prev = entry.tail;
        let release!: () => void;
        const nextTail = new Promise<void>((resolve) => {
            release = resolve;
        });
        entry.tail = nextTail;

        try {
            await prev;
            return await task();
        } finally {
            entry.pending -= 1;
            if (entry.pending <= 0 && this.#queues.get(sessionId) === entry) {
                this.#queues.delete(sessionId);
            }
            release();
        }
    }

    getPendingCount(sessionId: string): number {
        return this.#queues.get(sessionId)?.pending ?? 0;
    }
}
