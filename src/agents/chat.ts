import { env, envRequired } from "../config/index.ts";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { RedisChatMessageHistory } from "@langchain/redis";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/community/tools/dynamic";

import {
    createCodeExecution,
    createCurrentDateTime,
    createKnowledgeDocs,
    createOpenWeatherMap,
} from "./tools/index.ts";

const model = new ChatOpenAI({
    configuration: {
        apiKey: envRequired("OPENAI_API_KEY"),
        baseURL: envRequired("OPENAI_BASE_URL"),
    },
    modelName: envRequired("OPENAI_MODEL_NAME"),
    temperature: 0.63,
});

const systemPrompt = envRequired("OPENAI_SYSTEM_PROMPT");
const redisUri = envRequired("REDIS_URI");

export function useModel(): ChatOpenAI {
    return model;
}

interface ToolAgentOptions {
    codeExecution?: { enabled?: boolean };
    openWeatherMap?: { enabled?: boolean; config?: { apiKey?: string } };
    knowledgeDocs?: { enabled?: boolean; config?: { googleApiKey?: string; googleOptions?: Record<string, unknown> } };
}

function getDefaultToolOptions(): ToolAgentOptions {
    return {
        codeExecution: {
            enabled: env("TOOL_CODE_EXECUTION_ENABLED") === "yes",
        },
        openWeatherMap: {
            enabled: env("TOOL_OPEN_WEATHER_MAP_QUERY_RUN_ENABLED") === "yes",
            config: { apiKey: env("TOOL_OPEN_WEATHER_MAP_API_KEY") ?? undefined },
        },
        knowledgeDocs: {
            enabled: env("TOOL_KNOWLEDGE_DOCS_ENABLED") === "yes",
            config: {
                googleApiKey: env("TOOL_KNOWLEDGE_DOCS_GOOGLE_API_KEY") ?? undefined,
                googleOptions: JSON.parse(env("TOOL_KNOWLEDGE_DOCS_GOOGLE_OPTIONS") || "{}") as Record<string, unknown>,
            },
        },
    };
}

function collectTools(opts: ToolAgentOptions = getDefaultToolOptions()): DynamicStructuredTool[] {
    const tools: DynamicStructuredTool[] = [createCurrentDateTime()];

    if (opts.codeExecution?.enabled) {
        tools.push(createCodeExecution());
    }

    if (opts.openWeatherMap?.enabled && opts.openWeatherMap.config?.apiKey) {
        tools.push(createOpenWeatherMap({ apiKey: opts.openWeatherMap.config.apiKey }));
    }

    if (opts.knowledgeDocs?.enabled && opts.knowledgeDocs.config?.googleApiKey) {
        tools.push(createKnowledgeDocs({
            googleApiKey: opts.knowledgeDocs.config.googleApiKey,
            googleOptions: opts.knowledgeDocs.config.googleOptions,
        }));
    }

    return tools;
}

export async function chatWithAI(chatId: string, humanInput: string, opts?: ToolAgentOptions): Promise<string> {
    const history = new RedisChatMessageHistory({
        config: { url: redisUri },
        sessionId: `nymph:agent:${chatId}`,
        sessionTTL: 150,
    });

    const historyMessages = await history.getMessages();
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt), ...historyMessages, new HumanMessage(humanInput)];

    const tools = collectTools(opts);
    const agent = createReactAgent({ llm: model, tools });
    const { messages: responseMessages } = await agent.invoke({ messages }) as { messages: BaseMessage[] };
    const aiMsg = responseMessages.findLast((m): m is AIMessage => m instanceof AIMessage);

    if (aiMsg) {
        history.addMessages([new HumanMessage(humanInput), aiMsg]).catch((e: unknown) =>
            console.error("Failed to save chat history:", e),
        );
    }

    return extractText(aiMsg);
}

function extractText(aiMsg: AIMessage | undefined): string {
    if (!aiMsg) return "";
    const { content } = aiMsg;
    if (typeof content === "string") return content;
    if (Array.isArray(content) && content.length) {
        const first = content[0];
        return typeof first === "string" ? first : JSON.stringify(first);
    }
    return String(aiMsg);
}

export function sliceContent(content: string, maxLength: number, separator = "\n"): string[] {
    const parts = content.split(separator);
    const snippets: string[] = [];
    let buffer = "";

    for (const part of parts) {
        if (!part) { buffer += separator; continue; }
        if (buffer.length + part.length < maxLength) { buffer += part; continue; }
        if (buffer.trim()) snippets.push(buffer.trim());
        buffer = part;
    }
    if (buffer.trim()) snippets.push(buffer.trim());
    return snippets;
}

export async function translateText(chatId: string, content: string, langs?: string[]): Promise<string> {
    const [langA, langB] = langs?.length === 2 ? langs : ["en", "zh"];

    const prompt = [
        "You are a translation assistant.",
        `Two languages: ${langA} and ${langB}.`,
        `If text is in ${langA}, translate to ${langB}; if in ${langB}, translate to ${langA}.`,
        "If it doesn't need translation, return unchanged.",
        "Preserve meaning and style. Only return translated text.",
        "", "Text:", content,
    ].join("\n");

    return (await chatWithAI(`${chatId}:translate:${langA}:${langB}`, prompt)).trim();
}
