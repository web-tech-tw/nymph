import schedule, { type Job } from "node-schedule";
import { PlatformName } from "../types/provider";
import type { ChatContext } from "../types/provider";
import { createChatAgent } from "../agents/chat";
import { snakeToCamelCase } from "../utils/text";
import type { DiscordProvider } from "../providers/discord";

export interface ScheduledPromptConfig {
    name: string;
    enabled?: boolean;
    time: string;
    channelId: string;
    prompt: string;
}

const jobMap = new Map<string, Job>();

/**
 * Normalizes snake_case keys from TOML to camelCase.
 */
function normalizeKeys(raw: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
        normalized[snakeToCamelCase(key)] = value;
    }
    return normalized;
}

/**
 * Reads and parses scheduled prompt jobs strictly from a TOML file.
 * Returns an empty array when the file is missing or unparsable.
 */
export async function getScheduledPromptsFromFile(
    filePath = Bun.env.SCHEDULE_CONFIG_PATH || "./schedule.toml",
): Promise<ScheduledPromptConfig[]> {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) return [];

    try {
        const parsed = Bun.TOML.parse(await file.text()) as Record<string, unknown>;
        const promptsSource = parsed.prompts || parsed.scheduled_prompts;
        if (!Array.isArray(promptsSource)) return [];

        const configs: ScheduledPromptConfig[] = [];
        for (const item of promptsSource) {
            if (!item || typeof item !== "object") continue;
            const def = normalizeKeys(item as Record<string, unknown>);

            const name = typeof def.name === "string" ? def.name : "";
            const time = typeof def.time === "string" ? def.time : "";
            const channelId = typeof def.channelId === "string" ? def.channelId : "";
            const prompt = typeof def.prompt === "string" ? def.prompt : "";

            if (!time || !channelId || !prompt) {
                console.warn(
                    `[Scheduler] Skipping invalid prompt entry "${name}": time, channel_id and prompt are required`,
                );
                continue;
            }

            configs.push({
                name,
                enabled: def.enabled !== false,
                time,
                channelId,
                prompt,
            });
        }
        return configs;
    } catch (error) {
        console.error(`[Scheduler] Failed to read or parse "${filePath}":`, error);
        return [];
    }
}

/**
 * Runs one scheduled prompt: sends the configured prompt through the chat
 * agent and delivers the reply to the configured Discord channel.
 */
const runScheduledPrompt = async (provider: DiscordProvider, config: ScheduledPromptConfig): Promise<void> => {
    console.info(`[Scheduler] Running prompt "${config.name}"`);
    try {
        const agent = await createChatAgent();
        const ctx: ChatContext = {
            platformName: PlatformName.Discord,
            roomId: config.channelId,
            sender: {
                id: "scheduler",
                nickname: config.name,
            },
            type: "text",
            content: config.prompt,
            reply: async (text: string) => {
                await provider.sendReply(config.channelId, text);
            },
        };

        const reply = await agent.replyMessage(ctx);
        if (reply) {
            await ctx.reply(reply);
        }
    } catch (error) {
        console.error(`[Scheduler] Failed to run prompt "${config.name}":`, error);
    }
};

/**
 * Starts all scheduled prompt jobs from the TOML config file.
 * Discord-only; jobs are configured exclusively via the config file
 * (never through agent tools or commands).
 */
export async function startScheduledPrompts(
    provider: DiscordProvider,
    filePath?: string,
): Promise<void> {
    stopScheduledPrompts();
    if (!provider.enabled) return;

    const configs = await getScheduledPromptsFromFile(filePath);
    for (const config of configs) {
        if (config.enabled === false) continue;

        const job = schedule.scheduleJob(config.time, () => {
            void runScheduledPrompt(provider, config);
        });
        if (!job) {
            console.error(`[Scheduler] Invalid cron expression "${config.time}" for prompt "${config.name}"`);
            continue;
        }

        const key = jobMap.has(config.name) ? `${config.name}#${jobMap.size}` : config.name;
        jobMap.set(key, job);
        console.info(
            `[Scheduler] Scheduled prompt "${config.name}" at "${config.time}" -> channel ${config.channelId}`,
        );
    }
}

/**
 * Stops all scheduled prompt jobs.
 */
export function stopScheduledPrompts(): void {
    for (const job of jobMap.values()) {
        job.cancel();
    }
    jobMap.clear();
}
