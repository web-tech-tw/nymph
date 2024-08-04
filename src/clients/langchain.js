"use strict";
// langchain is a toolkit for conversation models.

const {
    getMust,
} = require("../config");

const {
    ConversationChain,
} = require("langchain/chains");
const {
    BufferMemory,
} = require("langchain/memory");
const {
    RedisChatMessageHistory,
} = require("@langchain/redis");
const {
    ChatGoogleGenerativeAI,
} = require("@langchain/google-genai");
const {
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    MessagesPlaceholder,
} = require("@langchain/core/prompts");

const redisUrl = getMust("REDIS_URL");
const apiKey = getMust("GEMINI_API_KEY");
const modelName = getMust("GEMINI_MODEL_NAME");
const systemPrompt = getMust("GEMINI_SYSTEM_PROMPT");

const model = new ChatGoogleGenerativeAI({
    apiKey,
    modelName,
    temperature: 0.63,
});
const promptTemplate = ChatPromptTemplate.
    fromMessages([
        SystemMessagePromptTemplate.fromTemplate(systemPrompt),
        new MessagesPlaceholder("history"),
        ["human", "{humanInput}"],
    ]);

/**
 * Chat with the AI.
 * @param {string} chatId The chat ID to chat with the AI.
 * @param {string} humanInput The prompt to chat with the AI.
 * @return {Promise<string>} The response from the AI.
 */
async function chatWithAI(chatId, humanInput) {
    const chatHistory = new RedisChatMessageHistory({
        config: {
            url: redisUrl,
        },
        sessionId: `nymph:ai:${chatId}`,
        sessionTTL: 150,
    });

    const bufferMemory = new BufferMemory({
        returnMessages: true,
        memoryKey: "history",
        inputKey: "humanInput",
        chatHistory,
    });

    const conversationChain = new ConversationChain({
        llm: model,
        prompt: promptTemplate,
        memory: bufferMemory,
    });

    const {
        response: conversationResponse,
    } = await conversationChain.invoke({
        humanInput,
    });

    return conversationResponse;
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

exports.useModel = () => model;
exports.chatWithAI = chatWithAI;
exports.sliceContent = sliceContent;
