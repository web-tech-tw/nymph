import { describe, test, expect } from "bun:test";
import {
    extractQuickRepliesTag,
    buildArxivFlexMessage,
    buildHelpFlexMessage,
    buildLineQuickReply,
} from "./line-flex";

describe("line-flex utilities", () => {
    test("extractQuickRepliesTag strips tag and caps suggestions at 3 unique items", () => {
        const raw = "Main answer.\n\n<quick_replies>Q1|Q2|Q1|Q3|Q4</quick_replies>";
        const { cleanText, quickReplies } = extractQuickRepliesTag(raw);

        expect(cleanText).toBe("Main answer.");
        expect(quickReplies).toEqual(["Q1", "Q2", "Q3"]);
    });

    test("extractQuickRepliesTag leaves plain text untouched", () => {
        const { cleanText, quickReplies } = extractQuickRepliesTag("Plain response");
        expect(cleanText).toBe("Plain response");
        expect(quickReplies).toEqual([]);
    });

    test("buildArxivFlexMessage produces valid bubble with URI footer only for http(s) URLs", () => {
        const valid = buildArxivFlexMessage({
            title: "Sample Paper",
            url: "https://arxiv.org/abs/1706.03762",
            summary: "Summary.",
            comment: "Comment.",
        });
        expect(valid.type).toBe("flex");
        expect(valid.altText.length).toBeGreaterThan(0);
        expect(valid.altText.length).toBeLessThanOrEqual(400);
        expect(valid.contents.type).toBe("bubble");
        if (valid.contents.type === "bubble") {
            expect(valid.contents.footer).toBeDefined();
        }

        const invalidUrl = buildArxivFlexMessage({
            title: "Sample Paper",
            url: "javascript:alert(1)",
            summary: "Summary.",
            comment: "",
        });
        if (invalidUrl.contents.type === "bubble") {
            expect(invalidUrl.contents.footer).toBeUndefined();
        }
    });

    test("buildHelpFlexMessage produces valid bubble and includes footer only when baseUrl is valid", () => {
        const withUrl = buildHelpFlexMessage({ baseUrl: "https://example.com/nymph" });
        expect(withUrl.type).toBe("flex");
        expect(withUrl.altText.length).toBeLessThanOrEqual(400);
        if (withUrl.contents.type === "bubble") {
            expect(withUrl.contents.footer).toBeDefined();
        }

        const withoutUrl = buildHelpFlexMessage({});
        if (withoutUrl.contents.type === "bubble") {
            expect(withoutUrl.contents.footer).toBeUndefined();
        }
    });

    test("buildLineQuickReply enforces LINE 20-char label limit and returns non-empty items for all modes", () => {
        const modes = [
            buildLineQuickReply({ converged: true }),
            buildLineQuickReply({ isArxiv: true }),
            buildLineQuickReply({ isSystemCard: true }),
            buildLineQuickReply({}),
            buildLineQuickReply({ suggestions: ["A".repeat(40), "Short"] }),
        ];

        for (const qr of modes) {
            expect(qr.items && qr.items.length > 0).toBe(true);
            for (const item of qr.items ?? []) {
                expect(item.action?.type).toBe("message");
                expect((item.action?.label ?? "").length).toBeLessThanOrEqual(20);
            }
        }
    });
});
