import { describe, expect, it } from "bun:test";
import {
    splitCells,
    isTableDelimiter,
    parseMarkdownToAst,
    formatTableAsDiscordList,
    convertMarkdownTablesToDiscordLists,
    type TableNode
} from "./markdown-table-ast";

describe("Markdown Table AST Parser & Transformer", () => {
    describe("splitCells", () => {
        it("splits standard piped row correctly", () => {
            expect(splitCells("| 項目 | 內容 |")).toEqual(["項目", "內容"]);
        });

        it("splits row without outer pipes", () => {
            expect(splitCells("項目 | 內容")).toEqual(["項目", "內容"]);
        });

        it("respects inline code containing pipe", () => {
            expect(splitCells("| `foo | bar` | baz |")).toEqual(["`foo | bar`", "baz"]);
        });

        it("respects escaped pipes", () => {
            expect(splitCells("| col1 | a \\| b |")).toEqual(["col1", "a \\| b"]);
        });
    });

    describe("isTableDelimiter", () => {
        it("recognizes standard delimiter rows", () => {
            expect(isTableDelimiter("|---|---|")).toBe(true);
            expect(isTableDelimiter("|:---|:---:|---:|")).toBe(true);
            expect(isTableDelimiter("---|---")).toBe(true);
            expect(isTableDelimiter("| ------ | ------ |")).toBe(true);
        });

        it("rejects non-delimiter rows", () => {
            expect(isTableDelimiter("| 項目 | 內容 |")).toBe(false);
            expect(isTableDelimiter("Just some text")).toBe(false);
            expect(isTableDelimiter("| | |")).toBe(false);
        });
    });

    describe("formatTableAsDiscordList", () => {
        it("formats 2-column key-value table", () => {
            const table: TableNode = {
                type: "table",
                headers: ["項目", "內容"],
                alignments: ["none", "none"],
                rows: [
                    ["開發者", "Anthropic"],
                    ["正式名稱", "Claude Mythos"],
                ],
            };
            const result = formatTableAsDiscordList(table);
            expect(result).toBe(
                "- **開發者**：Anthropic\n" +
                "- **正式名稱**：Claude Mythos"
            );
        });

        it("formats 3-column table as nested list", () => {
            const table: TableNode = {
                type: "table",
                headers: ["模型", "參數量", "用途"],
                alignments: ["none", "none", "none"],
                rows: [
                    ["Mythos", "8T", "資安專精"],
                    ["Sonnet", "未公開", "通用協助"],
                ],
            };
            const result = formatTableAsDiscordList(table);
            expect(result).toBe(
                "- **Mythos**\n" +
                "  - **參數量**：8T\n" +
                "  - **用途**：資安專精\n" +
                "- **Sonnet**\n" +
                "  - **參數量**：未公開\n" +
                "  - **用途**：通用協助"
            );
        });
    });

    describe("convertMarkdownTablesToDiscordLists", () => {
        it("converts the exact real-world Claude Mythos overview table from screenshot", () => {
            const input = `Mythos (Claude Mythos) 概覽

| 項目 | 內容 |
|---|---|
| 開發者 | Anthropic（前身為 OpenAI，後於 2025年併入） |
| 正式名稱 | Claude Mythos (常稱 Mythos) |
| 定位 | 高危險度、專注於 資訊安全與漏洞發掘 的大型語言模型 (LLM)，屬於 Anthropic 的 Claude 系列。 |
| 發布時間 | 2026年 4月 (預覽版)
之後陸續釋出 5版、5.1版等。|
| 核心特點 | 1. 資安專精：模型在閱讀程式碼、判斷攻擊面、生成 exploit 等方面遠超一般 LLM。
2. 高參數規模：官方估計約 8兆參數 (=8 trillion)，遠大於同時期的 GPT-5 系列。
3. 雙版本：
- Claude Mythos (完整能力、較少安全防護)
- Claude Fable (同樣底層模型，加入多層安全過濾，限制危險指令)。
4. 安全與對齊：Anthropic 在模型前端加入「危險操作」偵測與「安全分類器」以防止濫用。 |
| 典型應用 | - 自動化漏洞掃描：讀取大型軟體代碼庫，找出潛在的安全缺陷。
- 漏洞驗證：自動執行測試程式，確認漏洞是否可被利用。
- 安全報告生成：產出詳細的 bug 報告、PoC (Proof-of-Concept) 與修補建議。
- 攻防演練：在 Red-Team/Blue-Team 演練中作為「AI 攻擊者」角色。 |
| 授權與取得方式 | 只提供 受限存取 (Restricted Access) 給予特定企業、政府與研究機構。
透過 Anthropic 的 Project Glasswing 計畫分發，需簽署安全與合規協議。 |

簡要結論
Mythos 是目前已知的專門針對資訊安全而設計的前沿 AI 模型。`;

            const output = convertMarkdownTablesToDiscordLists(input);

            // Table markers must be completely gone
            expect(output).not.toContain("|---|---|");
            expect(output).not.toContain("| 項目 | 內容 |");
            expect(output).not.toContain("| 開發者 |");

            // Key-values must be formatted as Discord bullets
            expect(output).toContain("- **開發者**：Anthropic（前身為 OpenAI，後於 2025年併入）");
            expect(output).toContain("- **正式名稱**：Claude Mythos (常稱 Mythos)");
            expect(output).toContain("- **定位**：高危險度、專注於 資訊安全與漏洞發掘 的大型語言模型 (LLM)，屬於 Anthropic 的 Claude 系列。");

            // Multiline row "發布時間" must preserve content with indentation
            expect(output).toContain("- **發布時間**：2026年 4月 (預覽版)\n  之後陸續釋出 5版、5.1版等。");

            // Complex list in "典型應用" must be properly indented
            expect(output).toContain("- **典型應用**：\n  - 自動化漏洞掃描：讀取大型軟體代碼庫，找出潛在的安全缺陷。");

            // Surrounding paragraphs must remain intact
            expect(output).toContain("Mythos (Claude Mythos) 概覽");
            expect(output).toContain("簡要結論\nMythos 是目前已知的專門針對資訊安全而設計的前沿 AI 模型。");
        });

        it("preserves tables inside code blocks without modifying them", () => {
            const input = "Here is a code example:\n\n```markdown\n| col1 | col2 |\n|---|---|\n| a | b |\n```\n\nAnd normal text.";
            const output = convertMarkdownTablesToDiscordLists(input);

            expect(output).toContain("```markdown\n| col1 | col2 |\n|---|---|\n| a | b |\n```");
        });

        it("returns original text if there is no table", () => {
            const input = "Hello world! This is just plain text without any tables.";
            expect(convertMarkdownTablesToDiscordLists(input)).toBe(input);
        });

        it("parses AST nodes properly via parseMarkdownToAst", () => {
            const markdown = "# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconsole.log(1);\n```";
            const ast = parseMarkdownToAst(markdown);
            expect(ast.type).toBe("root");
            expect(ast.children.length).toBe(3);
            expect(ast.children[0]?.type).toBe("paragraph");
            expect(ast.children[1]?.type).toBe("table");
            expect(ast.children[2]?.type).toBe("code_block");
        });
    });
});
