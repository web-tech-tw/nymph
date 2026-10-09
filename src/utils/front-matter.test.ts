import { describe, it, expect } from "bun:test";
import { parseFrontMatter } from "./front-matter";

describe("parseFrontMatter", () => {
    it("should return empty meta when no front-matter exists", () => {
        const result = parseFrontMatter("# Hello\nWorld");
        expect(result.meta).toEqual({});
        expect(result.text).toBe("# Hello\nWorld");
    });

    it("should parse plain strings and bracketed arrays", () => {
        const content = "---\ntopic: 週會紀錄\ntags: [nymph, archiver]\nparticipants: [\"Alice\", 'Bob']\n---\n# Body";
        const result = parseFrontMatter(content);
        expect(result.meta["topic"]).toBe("週會紀錄");
        expect(result.meta["tags"]).toEqual(["nymph", "archiver"]);
        expect(result.meta["participants"]).toEqual(["Alice", "Bob"]);
        expect(result.text).toBe(content);
    });

    it("should ignore comments and lines without separator", () => {
        const content = "---\n# comment\nbroken line\ncategory: chat-archive\n---\n";
        const result = parseFrontMatter(content);
        expect(result.meta).toEqual({ category: "chat-archive" });
    });

    it("should return empty meta for unterminated front-matter block", () => {
        const content = "---\ntopic: never closed\n";
        const result = parseFrontMatter(content);
        expect(result.meta).toEqual({});
        expect(result.text).toBe(content);
    });
});
