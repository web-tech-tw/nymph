import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getOptional, getEnabled } from "../config.ts";
import { createAgent } from "langchain";
import { getMongoClient } from "../memory.ts";
import { MongoDBChatMessageHistory } from "@langchain/mongodb";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/community/tools/dynamic";

import {
    createCodeExecution,
    createCurrentDateTime,
    createKnowledgeDocs,
    createOpenWeatherMap,
    createTavilySearch,
} from "./tools/index.ts";

const settingsPath = fileURLToPath(new URL("../../settings.xml", import.meta.url));
const systemPrompt = existsSync(settingsPath)
    ? readFileSync(settingsPath, "utf-8").trim()
    : "You are Nymph, an AI assistant.";

let _model: ChatAnthropic | undefined;

export function useModel(): ChatAnthropic {
    if (!_model) {
        _model = new ChatAnthropic({
            apiKey: getOptional("ANTHROPIC_API_KEY") || "dummy",
            model: getOptional("ANTHROPIC_MODEL") || "claude-3-5-sonnet-20241022",
        });
    }
    return _model;
}

interface ToolAgentOptions {
    codeExecution?: { enabled?: boolean };
    openWeatherMap?: { enabled?: boolean; config?: { apiKey?: string } };
    knowledgeDocs?: { enabled?: boolean; config?: { googleApiKey?: string; googleOptions?: Record<string, unknown> } };
    tavilySearch?: { enabled?: boolean; config?: { apiKey?: string } };
}

function getDefaultToolOptions(): ToolAgentOptions {
    return {
        codeExecution: {
            enabled: getEnabled("TOOL_CODE_EXECUTION_ENABLED"),
        },
        openWeatherMap: {
            enabled: getEnabled("TOOL_OPEN_WEATHER_MAP_QUERY_RUN_ENABLED"),
            config: { apiKey: getOptional("TOOL_OPEN_WEATHER_MAP_API_KEY") },
        },
        knowledgeDocs: {
            enabled: getEnabled("TOOL_KNOWLEDGE_DOCS_ENABLED"),
            config: {
                googleApiKey: getOptional("TOOL_KNOWLEDGE_DOCS_GOOGLE_API_KEY"),
                googleOptions: JSON.parse(getOptional("TOOL_KNOWLEDGE_DOCS_GOOGLE_OPTIONS") || "{}") as Record<string, unknown>,
            },
        },
        tavilySearch: {
            enabled: getEnabled("TOOL_TAVILY_SEARCH_ENABLED"),
            config: { apiKey: getOptional("TOOL_TAVILY_SEARCH_API_KEY") },
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

    if (opts.tavilySearch?.enabled) {
        const tavilyTool = createTavilySearch(opts.tavilySearch.config?.apiKey);
        if (tavilyTool) tools.push(tavilyTool);
    }

    return tools;
}

export async function chatWithAI(chatId: string, humanInput: string, opts?: ToolAgentOptions): Promise<string> {
    const collection = getMongoClient().db().collection("chat_messages");
    const history = new MongoDBChatMessageHistory({
        collection,
        sessionId: `nymph:agent:${chatId}`,
    });

    const historyMessages = await history.getMessages();
    const messages: BaseMessage[] = [new SystemMessage(systemPrompt), ...historyMessages, new HumanMessage(humanInput)];

    const tools = collectTools(opts);
    const agent = createAgent({ model: useModel(), tools });
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
