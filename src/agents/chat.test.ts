import { describe, expect, it } from "bun:test";
import { createChatAgent, Chat } from "./chat";

describe("createChatAgent", () => {
    it("should instantiate Chat with OpenAI-compatible provider", async () => {
        const agent = await createChatAgent();
        expect(agent).toBeInstanceOf(Chat);
    });
});
