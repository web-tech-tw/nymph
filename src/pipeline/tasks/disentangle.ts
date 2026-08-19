import { PIPELINE_CONFIG } from "../config";
import type { MergedMessageBlock, DiscussionThread } from "../types";

export interface DisentangleOptions {
    gapMinutes?: number;
    minThreadMessages?: number;
}

/**
 * Segment continuous message blocks into discrete discussion threads based on conversational time gaps.
 * All semantic comprehension and technical value determination are delegated to the LLM.
 */
export function disentangleThreads(
    blocks: MergedMessageBlock[],
    options: DisentangleOptions = {},
): DiscussionThread[] {
    if (!blocks.length) return [];

    const gapMinutes = options.gapMinutes ?? PIPELINE_CONFIG.thresholds.threadGapMinutes;
    const minThreadMessages = options.minThreadMessages ?? PIPELINE_CONFIG.thresholds.minThreadMessages;

    const threads: DiscussionThread[] = [];
    let currentThreadBlocks: MergedMessageBlock[] = [];
    const gapMs = gapMinutes * 60 * 1000;

    function flushThread() {
        if (!currentThreadBlocks.length) return;

        // Skip trivial snippets with fewer than minimum required messages
        if (currentThreadBlocks.length < minThreadMessages) {
            currentThreadBlocks = [];
            return;
        }

        const firstBlock = currentThreadBlocks[0];
        const lastBlock = currentThreadBlocks[currentThreadBlocks.length - 1];
        if (!firstBlock || !lastBlock) return;

        const participants = Array.from(new Set(currentThreadBlocks.map((b) => b.author)));

        threads.push({
            id: `${firstBlock.date}_${firstBlock.startTime}_${currentThreadBlocks.length}`,
            date: firstBlock.date,
            startTime: firstBlock.startTime,
            endTime: lastBlock.endTime,
            participants,
            messages: currentThreadBlocks,
        });

        currentThreadBlocks = [];
    }

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block) continue;

        if (currentThreadBlocks.length === 0) {
            currentThreadBlocks.push(block);
            continue;
        }

        const prevBlock = currentThreadBlocks[currentThreadBlocks.length - 1];
        const isTimeGap = prevBlock ? block.startTimestampMs - prevBlock.endTimestampMs > gapMs : false;

        if (isTimeGap) {
            flushThread();
            currentThreadBlocks.push(block);
        } else {
            currentThreadBlocks.push(block);
        }
    }

    flushThread();
    return threads;
}
