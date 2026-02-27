// langchain is a toolkit for conversation models.

import { get, getMust } from "../config.ts";
import { createAgent } from "langchain";
import { RedisChatMessageHistory } from "@langchain/redis";
import { ChatOpenAI } from "@langchain/openai";
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
} from "@langchain/core/messages";

import {
    createCurrentDateTime,
    createKnowledgeDocs,
    createOpenWeatherMapQueryRun,
} from "../tools/index.ts";

// Use OpenAI as the LLM provider.
const baseURL = getMust("OPENAI_BASE_URL");
const apiKey = getMust("OPENAI_API_KEY");
const modelName = getMust("OPENAI_MODEL_NAME");
const systemPrompt = getMust("OPENAI_SYSTEM_PROMPT");
const redisUri = getMust("REDIS_URI");

const model = new ChatOpenAI({
    configuration: {
        apiKey,
        baseURL,
    },
    modelName,
    temperature: 0.63,
});

export async function chatWithAI(chatId: string, humanInput: string, opts: any = {}): Promise<string> {
    const chatHistory = new RedisChatMessageHistory({
        config: {
            url: redisUri,
        },
        sessionId: `nymph:ai:${chatId}`,
        sessionTTL: 150,
    });

    const historyMessages = await chatHistory.getMessages();

    const systemMsg = new SystemMessage(systemPrompt);
    const humanMsg = new HumanMessage(humanInput);
    const messages = [systemMsg, ...historyMessages, humanMsg];

    const agent = await createToolsAgent(opts);

    const { messages: responseMessages } = await agent.invoke({ messages });
    const aiMsg = responseMessages.findLast(AIMessage.isInstance);

    try {
        await chatHistory.addMessages([humanMsg, aiMsg]);
    } catch (e) {
        console.error("Failed to save messages to Redis history:", e);
    }

    let responseText = "";
    if (aiMsg) {
        if (typeof aiMsg.content === "string") {
            responseText = aiMsg.content;
        } else if (Array.isArray(aiMsg.content) && aiMsg.content.length) {
            responseText = typeof aiMsg.content[0] === "string"
                ? aiMsg.content[0]
                : JSON.stringify(aiMsg.content[0]);
        } else if (aiMsg.text) {
            responseText = aiMsg.text;
        } else {
            responseText = String(aiMsg);
        }
    }

    return responseText;
}

export function sliceContent(content: string, maxLength: number, separator = "\n"): string[] {
    const substrings = content.split(separator);
    const snippets: string[] = [];

    let lastSnippet = "";
    for (const text of substrings) {
        if (!text) {
            lastSnippet += separator;
            continue;
        }
        if (text.length + lastSnippet.length < maxLength) {
            lastSnippet += text;
            continue;
        }
        snippets.push(lastSnippet.trim());
        lastSnippet = "";
    }
    if (lastSnippet) {
        snippets.push(lastSnippet.trim());
    }

    return snippets;
}

export async function translateText(chatId: string, content: string, langs: string[] | null = null): Promise<string> {
    let langA = "en";
    let langB = "zh";
    if (langs && langs.length === 2) {
        [langA, langB] = langs;
    }

    const promptLines = [
        "You are a translation assistant.",
        "Two language codes are provided: " + langA + " and " + langB + ".",
        "For the given text, determine whether it is written in " + langA +
            " or " + langB + ".",
        "- If it is in " + langA + ",",
        "  translate it into " + langB + ".",
        "- If it is in " + langB + ",",
        "  translate it into " + langA + ".",
        "- If the text is already in the correct target language or",
        "  does not need translation,",
        "  return the original text unchanged.",
        "Preserve meaning and style.",
        "Only return the translated (or original) text",
        "without extra commentary.",
        "",
        "Text:",
        content,
    ];

    const prompt = promptLines.join("\n");

    const sessionId = chatId + ":translate:" + langA + ":" + langB;
    return (await chatWithAI(sessionId, prompt)).trim();
}

interface CreateToolsAgentOptions {
    openWeatherMapQueryRun?: {
        enabled?: boolean;
        config?: { apiKey?: string | null };
    };
    knowledgeDocs?: {
        enabled?: boolean;
        config?: {
            googleApiKey?: string | null;
            googleOptions?: any;
        };
    };
}

const DEFAULT_CREATE_TOOLS_AGENT_OPTS: CreateToolsAgentOptions = {
    openWeatherMapQueryRun: {
        enabled: get("TOOL_OPEN_WEATHER_MAP_QUERY_RUN_ENABLED") === "yes",
        config: {
            apiKey: get("TOOL_OPEN_WEATHER_MAP_API_KEY") || null,
        },
    },
    knowledgeDocs: {
        enabled: get("TOOL_KNOWLEDGE_DOCS_ENABLED") === "yes",
        config: {
            googleApiKey: get("TOOL_KNOWLEDGE_DOCS_GOOGLE_API_KEY") || null,
            googleOptions: JSON.parse(
                get("TOOL_KNOWLEDGE_DOCS_GOOGLE_OPTIONS") || "{}",
            ),
        },
    },
};

export async function createToolsAgent(
    opt: CreateToolsAgentOptions = DEFAULT_CREATE_TOOLS_AGENT_OPTS,
): Promise<any> {
    const tools: any[] = [createCurrentDateTime()];

    if (opt.openWeatherMapQueryRun?.enabled) {
        const weatherTool = await createOpenWeatherMapQueryRun(
            opt.openWeatherMapQueryRun.config,
        );
        tools.push(weatherTool);
    }

    if (opt.knowledgeDocs?.enabled) {
        const knowledgeDocsTool = await createKnowledgeDocs(
            opt.knowledgeDocs.config,
        );
        tools.push(knowledgeDocsTool);
    }

    const agent = createAgent({ model, tools });

    return agent;
}

export const useModel = () => model;
