import fs from "node:fs";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { PIPELINE_CONFIG } from "./config";
import type { RawMessageDoc, ExtractedKnowledge } from "./types";
import { extractAndDenoise, buildGlobalAuthorRegistry } from "./tasks/extractor";
import { disentangleThreads } from "./tasks/disentangle";
import { summarizeThread } from "./tasks/summarizer";
import { buildKnowledgeDocuments, loadKnowledgeDocuments, formatKnowledgeMarkdown } from "./tasks/loader";

export {
    extractAndDenoise,
    buildGlobalAuthorRegistry,
    disentangleThreads,
    summarizeThread,
    buildKnowledgeDocuments,
    loadKnowledgeDocuments,
    formatKnowledgeMarkdown,
    PIPELINE_CONFIG,
};

export interface PipelineOptions {
    dryRun?: boolean;
    resume?: boolean;
    days?: number;
    targetDate?: string;
    concurrency?: number;
}

export interface PipelineStats {
    totalRaw: number;
    totalMergedBlocks: number;
    totalCandidateThreads: number;
    totalExtractedItems: number;
    totalLoadedDocs: number;
}

interface CheckpointState {
    completedDates: string[];
    lastUpdated: string;
    totalExtracted: number;
}

function loadCheckpoint(file: string): CheckpointState {
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, "utf-8")) as CheckpointState;
        } catch {
            // Ignore parse errors and return fresh state
        }
    }
    return { completedDates: [], lastUpdated: new Date().toISOString(), totalExtracted: 0 };
}

function saveCheckpoint(file: string, state: CheckpointState) {
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(state, null, 2), "utf-8");
}

export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineStats> {
    const isDryRun = options.dryRun ?? false;
    const isResume = options.resume ?? false;
    const maxDays = options.days;
    const targetDateArg = options.targetDate;
    const concurrency = options.concurrency ?? PIPELINE_CONFIG.llm.concurrency;

    console.info("==================================================");
    console.info("Starting Technical Chat Extraction Pipeline");
    console.info(`- Model: ${PIPELINE_CONFIG.llm.model}`);
    console.info(`- Mode: ${isDryRun ? "DRY RUN (No target DB writes)" : "PRODUCTION (Writing to target DB)"}`);
    console.info(`- Concurrency: ${concurrency}`);
    if (maxDays) console.info(`- Limit: ${maxDays} days`);
    if (targetDateArg) console.info(`- Target Date: ${targetDateArg}`);
    console.info("==================================================\n");

    const checkpoint = isResume ? loadCheckpoint(PIPELINE_CONFIG.checkpointFile) : { completedDates: [], lastUpdated: "", totalExtracted: 0 };
    const processedSet = new Set(checkpoint.completedDates);

    // 1. Connect to source MongoDB
    if (!PIPELINE_CONFIG.source.uri) {
        throw new Error("SOURCE_MONGODB_URI environment variable is required.");
    }

    console.info("Connecting to source database...");
    const sourceClient = new MongoClient(PIPELINE_CONFIG.source.uri);
    await sourceClient.connect();
    const sourceDb = sourceClient.db(PIPELINE_CONFIG.source.dbName);
    const sourceCol = sourceDb.collection<RawMessageDoc>(PIPELINE_CONFIG.source.collectionName);

    // 2. Pre-index global author registry from historical system events
    console.info("Pre-indexing global author registry from historical events...");
    const globalAuthors = await buildGlobalAuthorRegistry(sourceCol);
    console.info(`Indexed ${globalAuthors.size} distinct authors in global registry.`);

    // 3. Fetch distinct dates
    let dates: string[] = [];
    if (targetDateArg) {
        dates = await sourceCol.distinct("date", { date: { $regex: targetDateArg } });
    } else {
        dates = await sourceCol.distinct("date");
    }

    dates.sort((a, b) => a.localeCompare(b));

    if (isResume && processedSet.size > 0) {
        dates = dates.filter((d) => !processedSet.has(d));
        console.info(`[Resume] Skipping ${processedSet.size} already processed dates. ${dates.length} dates remaining.`);
    }

    if (maxDays && maxDays > 0) {
        dates = dates.slice(0, maxDays);
    }

    console.info(`[Pipeline] Found ${dates.length} dates to process.\n`);

    const stats: PipelineStats = {
        totalRaw: 0,
        totalMergedBlocks: 0,
        totalCandidateThreads: 0,
        totalExtractedItems: 0,
        totalLoadedDocs: 0,
    };

    for (let dIndex = 0; dIndex < dates.length; dIndex++) {
        const dateStr = dates[dIndex];
        if (!dateStr) continue;

        console.info("──────────────────────────────────────────────────");
        console.info(`[${dIndex + 1}/${dates.length}] Processing Date: ${dateStr}`);

        // Fetch all raw messages for this date, sorted by time
        const rawDocs = await sourceCol
            .find({ date: dateStr })
            .sort({ time: 1, createdAt: 1 })
            .toArray();

        stats.totalRaw += rawDocs.length;
        console.info(`  - Raw messages fetched: ${rawDocs.length}`);

        if (!rawDocs.length) {
            processedSet.add(dateStr);
            continue;
        }

        // Task 1: Extract, Denoise & Merge
        const mergedBlocks = extractAndDenoise(rawDocs, globalAuthors);
        stats.totalMergedBlocks += mergedBlocks.length;
        console.info(`  - Merged into blocks: ${mergedBlocks.length}`);

        // Task 2: Disentangle Discussion Threads
        const threads = disentangleThreads(mergedBlocks);
        stats.totalCandidateThreads += threads.length;
        console.info(`  - Segmented discussion threads: ${threads.length}`);

        if (!threads.length) {
            console.info("  - No discussion threads formed on this date.");
            processedSet.add(dateStr);
            checkpoint.completedDates = Array.from(processedSet);
            if (!isDryRun) saveCheckpoint(PIPELINE_CONFIG.checkpointFile, checkpoint);
            continue;
        }

        // Task 3: LLM Summarization with Concurrency Control
        console.info(`  - Summarizing ${threads.length} threads with ${PIPELINE_CONFIG.llm.model}...`);
        const extractedItems: ExtractedKnowledge[] = [];

        for (let i = 0; i < threads.length; i += concurrency) {
            const batch = threads.slice(i, i + concurrency);
            const promises = batch.map((t) => summarizeThread(t, PIPELINE_CONFIG.llm.model));
            const results = await Promise.all(promises);

            for (const res of results) {
                if (res) {
                    extractedItems.push(res);
                }
            }
        }

        stats.totalExtractedItems += extractedItems.length;
        console.info(`  - Extracted ${extractedItems.length} valuable knowledge items.`);

        // Print preview
        for (const item of extractedItems) {
            console.info(`    + [${item.category}] ${item.topic} (Tags: ${item.tags.join(", ")})`);
            if (isDryRun) {
                console.info("\n--- PREVIEW MARKDOWN SLICE ---");
                console.info(formatKnowledgeMarkdown(item));
                console.info("------------------------------\n");
            }
        }

        // Task 4: Load to Target MongoDB
        if (!isDryRun && extractedItems.length > 0) {
            const knowledgeDocs = buildKnowledgeDocuments(extractedItems);
            const { inserted, updated } = await loadKnowledgeDocuments(knowledgeDocs);
            stats.totalLoadedDocs += inserted + updated;
            console.info(`  - Target DB: ${inserted} inserted, ${updated} updated.`);
        }

        processedSet.add(dateStr);
        checkpoint.completedDates = Array.from(processedSet);
        checkpoint.totalExtracted += extractedItems.length;
        if (!isDryRun) saveCheckpoint(PIPELINE_CONFIG.checkpointFile, checkpoint);
    }

    // Cleanup connections
    await sourceClient.close();
    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }

    console.info("\n==================================================");
    console.info("Pipeline Execution Completed Summary");
    console.info(`- Total Raw Messages Processed: ${stats.totalRaw}`);
    console.info(`- Total Merged Message Blocks: ${stats.totalMergedBlocks}`);
    console.info(`- Total Candidate Tech Threads: ${stats.totalCandidateThreads}`);
    console.info(`- Total Knowledge Items Extracted: ${stats.totalExtractedItems}`);
    if (!isDryRun) {
        console.info(`- Total Documents Loaded to Target DB: ${stats.totalLoadedDocs}`);
    }
    console.info("==================================================");

    return stats;
}

// CLI entry point
if (import.meta.main) {
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");
    const isResume = args.includes("--resume");
    const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1];
    const maxDays = daysArg ? Number.parseInt(daysArg, 10) : undefined;
    const targetDateArg = args.find((a) => a.startsWith("--date="))?.split("=")[1];
    const concurrencyArg = args.find((a) => a.startsWith("--concurrency="))?.split("=")[1];
    const concurrency = concurrencyArg ? Number.parseInt(concurrencyArg, 10) : undefined;

    runPipeline({
        dryRun: isDryRun,
        resume: isResume,
        days: maxDays,
        targetDate: targetDateArg,
        concurrency,
    }).catch((err) => {
        console.error("❌ Pipeline Error:", err);
        process.exit(1);
    });
}
