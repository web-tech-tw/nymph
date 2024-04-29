"use strict";
// Gemini is a generative AI model developed by Google.

const {GoogleGenerativeAI} = require("@google/generative-ai");

const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = client.getGenerativeModel({model: "gemini-pro"});

const chatSessions = {};

exports.useClient = () => client;
exports.useModel = () => model;
exports.usePrompts = (prompts) => function useChatSession(chatId) {
    let session = chatSessions[chatId];
    if (!session) {
        session = model.startChat({
            history: prompts,
            generationConfig: {
                maxOutputTokens: 500,
            },
        });
        chatSessions[chatId] = session;
    }
    return session;
};
