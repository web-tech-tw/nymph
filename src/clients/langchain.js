"use strict";
// langchain is a toolkit for conversation models.

const {
    getMust,
} = require("../config");

const {
    createAgent,
} = require("langchain");
const {
    RedisChatMessageHistory,
} = require("@langchain/redis");
const {
    ChatOpenAI,
} = require("@langchain/openai");
const {
    AIMessage,
    HumanMessage,
    SystemMessage,
} = require("@langchain/core/messages");

const {
    createCurrentDateTime,
    createOpenWeatherMapQueryRun,
} = require("../tools");

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

/**
 * Chat with the AI.
 * @param {string} chatId The chat ID to chat with the AI.
 * @param {string} humanInput The prompt to chat with the AI.
 * @param {object} [opts] Additional options.
 * @return {Promise<string>} The response from the AI.
 */
async function chatWithAI(chatId, humanInput, opts = {}) {
    const chatHistory = new RedisChatMessageHistory({
        config: {
            url: redisUri,
        },
        sessionId: `nymph:ai:${chatId}`,
        sessionTTL: 150,
    });

    // Load previous messages from Redis history
    const historyMessages = await chatHistory.getMessages();

    // Build message list: system prompt, previous history, current human input
    const systemMsg = new SystemMessage(systemPrompt);
    const humanMsg = new HumanMessage(humanInput);
    const messages = [systemMsg, ...historyMessages, humanMsg];

    // Wrap the model with tools as an agent
    const agent = await createToolsAgent(opts);

    // Call the model directly with messages
    const {messages: responseMessages} = await agent.invoke({messages});
    const aiMsg = responseMessages.findLast(AIMessage.isInstance);

    // Persist human + AI messages to history
    try {
        await chatHistory.addMessages([humanMsg, aiMsg]);
    } catch (e) {
        // Non-fatal — log but keep working
        console.error("Failed to save messages to Redis history:", e);
    }

    // Normalize response text
    let responseText = "";
    if (aiMsg) {
        if (typeof aiMsg.content === "string") {
            responseText = aiMsg.content;
        } else if (Array.isArray(aiMsg.content) && aiMsg.content.length) {
            responseText = typeof aiMsg.content[0] === "string" ?
                aiMsg.content[0] : JSON.stringify(aiMsg.content[0]);
        } else if (aiMsg.text) {
            responseText = aiMsg.text;
        } else {
            responseText = String(aiMsg);
        }
    }

    return responseText;
}

/**
 * Slice the message content into multiple snippets.
 * @param {string} content - The content to slice.
 * @param {number} maxLength - The maximum length of each snippet.
 * @param {string} separator - The separator to split the content.
 * @return {Array<string>} The sliced snippets.
 */
function sliceContent(content, maxLength, separator = "\n") {
    const substrings = content.split(separator);
    const snippets = [];

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

/**
 * Translate text between two languages if needed, preserving meaning.
 * Returns the original text if no translation is necessary.
 * @param {string} chatId
 * @param {string} content
 * @param {string[]} [langs] - Optional array of two language codes.
 *  Example: ["en", "zh"].
 * @return {Promise<string>}
 */
async function translateText(chatId, content, langs = null) {
    // langs should be an array of two language codes, e.g. ["en", "zh"].
    // If langs is not provided, assume English <-> Chinese as default.
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

/**
 * Create or initialize a tools-enabled agent executor.
 * @param {object} options
 * @param {string} [options.openWeatherApiKey] - Optional OpenWeather API
 * key override.
 * @return {Promise<object>} The executor with a `call` method.
 */
async function createToolsAgent({openWeatherApiKey = null} = {}) {
    const tools = [
        createCurrentDateTime(),
        createOpenWeatherMapQueryRun({
            apiKey: openWeatherApiKey || getMust("OPENWEATHER_API_KEY"),
        }),
    ];

    const agent = createAgent({model, tools});

    return agent;
}

exports.useModel = () => model;
exports.chatWithAI = chatWithAI;
exports.sliceContent = sliceContent;
exports.translateText = translateText;
exports.createToolsAgent = createToolsAgent;
