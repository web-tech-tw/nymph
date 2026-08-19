import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { PIPELINE_CONFIG } from "../config";
import type { DiscussionThread, ExtractedKnowledge } from "../types";

const anthropic = createAnthropic({
    apiKey: PIPELINE_CONFIG.llm.apiKey || Bun.env.ANTHROPIC_API_KEY,
    baseURL: PIPELINE_CONFIG.llm.baseURL,
});

export const TechnicalSummarySchema = z.object({
    hasTechnicalKnowledge: z
        .boolean()
        .describe(
            "Whether this conversation contains concrete, valuable technical knowledge, debugging experience, " +
            "pitfalls, or architectural decisions. Set to false if it is purely inconclusive casual chatter, " +
            "emotional venting, or greetings without substantive technical value.",
        ),
    category: z
        .enum([
            "Frontend",
            "Backend",
            "DevOps & Infrastructure",
            "Database & Storage",
            "AI & Machine Learning",
            "System Architecture",
            "Security & Auth",
            "Tools & Best Practices",
            "General Tech",
        ])
        .describe("Primary technical domain category"),
    topic: z.string().describe("Concise technical topic title (e.g. 'Docker container cross-host DNS resolution failure troubleshooting')"),
    problemBackground: z.string().describe("Problem background, error symptoms, stack traces, or technical context that initiated the discussion"),
    attemptsAndEvaluations: z
        .array(
            z.object({
                solution: z.string().describe("Proposed solution or approach attempted during the discussion"),
                status: z.enum(["accepted", "rejected", "investigating"]).describe("Evaluation status of this attempt"),
                reason: z.string().optional().describe("Reason why this approach was accepted or rejected"),
            }),
        )
        .describe("List of approaches, workarounds, or solutions attempted and evaluated in the discussion"),
    consensus: z.string().describe("Final adopted solution, architectural decision, consensus conclusion, or workaround"),
    actionItems: z.array(z.string()).describe("Pending action items, follow-up issues, or recommended validation tasks"),
    codeSnippetsOrLinks: z.array(z.string()).describe("Key code snippets, CLI commands, or external reference URLs mentioned in the discussion"),
    tags: z.array(z.string()).describe("Key lowercase technical tags (e.g. ['docker', 'dns', 'alpine'])"),
});

export type TechnicalSummaryResult = z.infer<typeof TechnicalSummarySchema>;

const EXTRACTION_SYSTEM_PROMPT = `You are a senior technical specialist and technical documentation engineer.
Your task is to extract structured, high-value technical knowledge, troubleshooting/debugging records, or architectural decisions and consensus from group chat transcripts.

[Guidelines]
1. Strict Noise Filtering: If the conversation mentions technical terms but is merely casual chatter, venting, inconclusive bantering, or lacks concrete problem resolution, set "hasTechnicalKnowledge" to false.
2. Faithful Extraction: Preserve the actual troubleshooting thought process (which solutions failed, why they failed, and what ultimately resolved the issue).
3. Structured Precision: Transform informal chat phrasing into clear, professional technical documentation in Traditional Chinese (繁體中文), accurately extracting code snippets, CLI commands, and reference URLs.
4. Clean Classification: Categorize accurately into the most appropriate technical category and provide 2-5 lowercase technical tags.`;

/**
 * Summarize a single technical discussion thread using Claude Haiku 4.5
 */
export async function summarizeThread(
    thread: DiscussionThread,
    modelName = PIPELINE_CONFIG.llm.model,
): Promise<ExtractedKnowledge | null> {
    const chatTranscript = thread.messages
        .map((m) => `[${m.startTime}] ${m.author}:\n${m.content}`)
        .join("\n\n");

    const totalRawCount = thread.messages.reduce(
        (sum, m) => sum + m.rawMessageIds.length,
        0,
    );

    try {
        const { object } = await generateObject({
            model: anthropic(modelName),
            schema: TechnicalSummarySchema,
            system: EXTRACTION_SYSTEM_PROMPT,
            prompt: `Analyze the following chat transcript and perform structured technical extraction:\n\nDate: ${thread.date}\nParticipants: ${thread.participants.join(", ")}\n\n[Chat Transcript]\n${chatTranscript}`,
        });

        if (!object.hasTechnicalKnowledge) {
            return null;
        }

        return {
            category: object.category,
            topic: object.topic,
            problemBackground: object.problemBackground,
            attemptsAndEvaluations: object.attemptsAndEvaluations,
            consensus: object.consensus,
            actionItems: object.actionItems,
            codeSnippetsOrLinks: object.codeSnippetsOrLinks,
            tags: object.tags.map((t) => t.toLowerCase().trim()).filter(Boolean),
            sourceDateRange: {
                start: `${thread.date} ${thread.startTime}`,
                end: `${thread.date} ${thread.endTime}`,
            },
            participants: thread.participants,
            rawMessageCount: totalRawCount,
        };
    } catch (error) {
        console.error(`[Summarizer] Failed to summarize thread ${thread.id}:`, error);
        return null;
    }
}
