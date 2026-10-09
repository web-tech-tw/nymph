import { describe, it, expect } from "bun:test";
import {
    isArxivUrl,
    extractArxivUrls,
    formatArxivPaperTag,
    sanitizeArxivPaperTags,
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
