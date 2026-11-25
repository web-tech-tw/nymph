import test from "node:test";
import assert from "node:assert/strict";
import { sliceContent } from "./slice.ts";

test("preserves newlines in multi-line text and code", () => {
    const input = [
        "import os",
        "import datetime",
        "import pandas as pd",
        "",
        "def main():",
        "    print(\"hello\")",
    ].join("\n");

    const chunks = sliceContent(input, 2000);
    assert.deepEqual(chunks, [input]);
});

test("never exceeds maxLength even on a single long line", () => {
    const longLine = "a".repeat(250);
    const chunks = sliceContent(longLine, 100);
    assert.ok(chunks.length >= 3);
    for (const chunk of chunks) {
        assert.ok(chunk.length <= 100, `chunk too long: ${chunk.length}`);
    }
    assert.equal(chunks.join(""), longLine);
});

test("closes and reopens Markdown fenced code blocks across chunks", () => {
    const input = [
        "說明文字",
        "```python",
        "line_1 = 'alpha'",
        "line_2 = 'bravo'",
        "line_3 = 'charlie'",
        "line_4 = 'delta'",
        "```",
        "結尾文字",
    ].join("\n");

    const chunks = sliceContent(input, 55);
    assert.ok(chunks.length >= 2);

    for (const chunk of chunks) {
        assert.ok(chunk.length <= 55, `chunk exceeded maxLength: ${chunk.length}\n${chunk}`);
        const fenceCount = (chunk.match(/^```/gm) ?? []).length;
        assert.equal(fenceCount % 2, 0, `unbalanced code fence in chunk:\n${chunk}`);
    }

    assert.ok(chunks[0].includes("```python"));
    assert.ok(chunks[1].startsWith("```python\n"));
    assert.equal(chunks.at(-1)?.endsWith("結尾文字"), true);
});
