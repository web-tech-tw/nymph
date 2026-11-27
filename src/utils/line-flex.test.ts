import { describe, test, expect } from "bun:test";
import {
    extractQuickRepliesTag,
    buildArxivFlexMessage,
    buildStatusFlexMessage,
    buildHelpFlexMessage,
    buildLineQuickReply,
} from "./line-flex";

describe("LINE Flex Message & Quick Reply helpers", () => {
    test("extractQuickRepliesTag should parse and strip <quick_replies> tags", () => {
        const raw = "這是主要回答內容。\n\n<quick_replies>怎麼設定快取？|有範例程式嗎？|第三個應被忽略</quick_replies>";
        const { cleanText, quickReplies } = extractQuickRepliesTag(raw);

        expect(cleanText).toBe("這是主要回答內容。");
        expect(quickReplies).toEqual(["怎麼設定快取？", "有範例程式嗎？"]);
    });

    test("extractQuickRepliesTag should return original text when tag is absent", () => {
        const { cleanText, quickReplies } = extractQuickRepliesTag("純文字回覆");
        expect(cleanText).toBe("純文字回覆");
        expect(quickReplies).toEqual([]);
    });

    test("buildArxivFlexMessage should render bubble with URI button for valid https URL", () => {
        const flex = buildArxivFlexMessage({
            title: "Attention Is All You Need",
            url: "https://arxiv.org/abs/1706.03762",
            summary: "提出 Transformer 架構，以自注意力取代循環神經網路。",
            comment: "現代大型語言模型的奠基論文。",
        });

        expect(flex.type).toBe("flex");
        expect(flex.altText).toContain("Attention Is All You Need");
        expect(flex.altText.length).toBeLessThanOrEqual(400);
        expect(flex.contents.type).toBe("bubble");
        if (flex.contents.type === "bubble") {
            expect(flex.contents.footer).toBeDefined();
        }
    });

    test("buildArxivFlexMessage should omit footer button for invalid URL", () => {
        const flex = buildArxivFlexMessage({
            title: "Test Paper",
            url: "javascript:alert(1)",
            summary: "Summary text",
            comment: "",
        });

        expect(flex.contents.type).toBe("bubble");
        if (flex.contents.type === "bubble") {
            expect(flex.contents.footer).toBeUndefined();
        }
    });

    test("buildStatusFlexMessage and buildHelpFlexMessage should build valid bubbles", () => {
        const statusFlex = buildStatusFlexMessage({
            model: "zai-glm-5-3-flash",
            visionModel: "mistral-small-2603",
            dbConnected: true,
            toolCount: 8,
            mcpServers: [{ name: "firecrawl", connected: true, toolCount: 3 }],
        });
        expect(statusFlex.type).toBe("flex");
        expect(statusFlex.altText).toContain("zai-glm-5-3-flash");

        const helpFlex = buildHelpFlexMessage({ baseUrl: "https://web-tech.tw/nymph" });
        expect(helpFlex.type).toBe("flex");
        expect(helpFlex.contents.type).toBe("bubble");
    });

    test("buildLineQuickReply should generate contextual buttons with labels <= 20 chars", () => {
        const converged = buildLineQuickReply({ converged: true });
        expect(converged.items?.[0]?.action?.label).toContain("繼續深入查證");

        const arxiv = buildLineQuickReply({ isArxiv: true });
        expect(arxiv.items?.some((i) => i.action?.label?.includes("方法與架構"))).toBe(true);

        const aiDynamic = buildLineQuickReply({
            suggestions: ["這是一段故意超過二十個字元的超長追問建議文字用來測試截斷邏輯"],
        });
        const firstLabel = aiDynamic.items?.[0]?.action?.label ?? "";
        expect(firstLabel.length).toBeLessThanOrEqual(20);
        expect(firstLabel.endsWith("…")).toBe(true);
    });
});
