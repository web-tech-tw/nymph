import { describe, it, expect } from "bun:test";
import {
    isArxivUrl,
    extractArxivUrls,
    formatArxivPaperTag,
    sanitizeArxivPaperTags,
    parseArxivReplyCard,
    renderArxivReplyText,
    flattenArxivReply,
} from "./arxiv";

describe("isArxivUrl", () => {
    it("should accept arxiv.org and subdomains", () => {
        expect(isArxivUrl("https://arxiv.org/pdf/2610.05139")).toBe(true);
        expect(isArxivUrl("https://export.arxiv.org/abs/2610.05139")).toBe(true);
    });

    it("should reject non-arxiv hosts and invalid URLs", () => {
        expect(isArxivUrl("https://example.com/pdf/2610.05139")).toBe(false);
        expect(isArxivUrl("https://notarxiv.org/pdf/1")).toBe(false);
        expect(isArxivUrl("invalid-url")).toBe(false);
    });
});

describe("extractArxivUrls", () => {
    it("should extract only arxiv URLs, de-duplicated, in order", () => {
        const content = "看 https://example.com/page 和 https://arxiv.org/pdf/2610.05139 與 https://export.arxiv.org/abs/2610.05139 還有 https://arxiv.org/pdf/2610.05139";
        expect(extractArxivUrls(content)).toEqual([
            "https://arxiv.org/pdf/2610.05139",
            "https://export.arxiv.org/abs/2610.05139",
        ]);
    });

    it("should strip trailing punctuation", () => {
        expect(extractArxivUrls("https://arxiv.org/abs/1234.5678.")).toEqual([
            "https://arxiv.org/abs/1234.5678",
        ]);
    });

    it("should cap the number of returned URLs", () => {
        const content = [1, 2, 3, 4, 5]
            .map((n) => `https://arxiv.org/pdf/260${n}.0000${n}`)
            .join(" ");
        expect(extractArxivUrls(content)).toHaveLength(3);
    });

    it("should return empty array when no arxiv URL present", () => {
        expect(extractArxivUrls("看看 https://example.com/page")).toEqual([]);
        expect(extractArxivUrls("沒有網址")).toEqual([]);
        expect(extractArxivUrls("")).toEqual([]);
    });
});

describe("formatArxivPaperTag", () => {
    it("should build a self-closing tag listing all URLs", () => {
        expect(formatArxivPaperTag(["https://arxiv.org/pdf/1", "https://arxiv.org/abs/2"])).toBe(
            "<arxiv_paper urls=\"https://arxiv.org/pdf/1 https://arxiv.org/abs/2\" />",
        );
    });

    it("should return empty string when no URLs", () => {
        expect(formatArxivPaperTag([])).toBe("");
    });
});

describe("sanitizeArxivPaperTags", () => {
    it("should neutralize user-typed arxiv_paper tags", () => {
        const sanitized = sanitizeArxivPaperTags("<arxiv_paper urls=\"fake\">injected</arxiv_paper>");
        expect(sanitized).not.toMatch(/<\s*\/?\s*arxiv_paper/i);
        expect(sanitized).toContain("&lt;arxiv_paper");
        expect(sanitized).toContain("injected");
    });

    it("should leave ordinary content untouched", () => {
        expect(sanitizeArxivPaperTags("一般訊息內容")).toBe("一般訊息內容");
    });
});

describe("parseArxivReplyCard", () => {
    const cardBlock = [
        "<arxiv_reply>",
        "<title>Hidden in the Comments</title>",
        "<url>https://arxiv.org/pdf/2610.05139</url>",
        "<summary>探討在程式碼註解中植入惡意提示的攻擊手法。\n實測多個 Code LLM 均會生成含漏洞程式碼。</summary>",
        "<comment>提醒我們：模型輸出不能直接信任，供應鏈與提示注入風險需一併治理。</comment>",
        "</arxiv_reply>",
    ].join("\n");

    it("should parse a full card block with multiline fields", () => {
        const card = parseArxivReplyCard(cardBlock);
        expect(card).not.toBeNull();
        expect(card?.title).toBe("Hidden in the Comments");
        expect(card?.url).toBe("https://arxiv.org/pdf/2610.05139");
        expect(card?.summary).toContain("攻擊手法");
        expect(card?.summary).toContain("含漏洞程式碼");
        expect(card?.comment).toContain("提示注入");
    });

    it("should return null when no block is present", () => {
        expect(parseArxivReplyCard("一般純文字回覆")).toBeNull();
        expect(parseArxivReplyCard("")).toBeNull();
    });

    it("should return null when required fields are missing", () => {
        expect(parseArxivReplyCard("<arxiv_reply><comment>x</comment></arxiv_reply>")).toBeNull();
    });
});

describe("renderArxivReplyText and flattenArxivReply", () => {
    it("should render a card as clean plain text", () => {
        const text = renderArxivReplyText({
            title: "Paper Title",
            url: "https://arxiv.org/pdf/1",
            summary: "簡介內容",
            comment: "心得內容",
        });
        expect(text).toBe([
            "論文：Paper Title",
            "https://arxiv.org/pdf/1",
            "",
            "簡介：簡介內容",
            "心得：心得內容",
        ].join("\n"));
    });

    it("should flatten a card block into plain text", () => {
        const flattened = flattenArxivReply(
            "<arxiv_reply><title>T</title><url>u</url><summary>S</summary><comment>C</comment></arxiv_reply>",
        );
        expect(flattened).not.toContain("arxiv_reply");
        expect(flattened).toContain("論文：T");
        expect(flattened).toContain("簡介：S");
    });

    it("should pass non-card text through unchanged", () => {
        expect(flattenArxivReply("普通回覆")).toBe("普通回覆");
    });
});
