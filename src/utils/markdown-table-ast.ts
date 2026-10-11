/**
 * Markdown Table to Discord List AST Parser & Transformer.
 *
 * Parses Markdown into an AST consisting of code blocks, tables, and paragraphs.
 * Specifically converts Markdown tables (including LLM-generated loose multiline tables)
 * into Discord-compatible nested lists, while preserving fenced code blocks intact.
 */

export interface CodeBlockNode {
    type: "code_block";
    fence: string;
    lang?: string;
    content: string;
}

export interface TableNode {
    type: "table";
    headers: string[];
    alignments: ("left" | "center" | "right" | "none")[];
    rows: string[][];
}

export interface ParagraphBlockNode {
    type: "paragraph";
    content: string;
}

export type MarkdownBlockNode = CodeBlockNode | TableNode | ParagraphBlockNode;

export interface MarkdownAst {
    type: "root";
    children: MarkdownBlockNode[];
}

const FENCE_START_REGEX = /^([`~]{3,})(.*)$/;
const HEADING_REGEX = /^#{1,6}\s+/;
const DELIMITER_CHAR_REGEX = /^[\s\-:|]+$/;

/**
 * Splits a table line into cells, taking into account escapes and inline code.
 */
export function splitCells(line: string): string[] {
    const trimmed = line.trim();
    const cells: string[] = [];
    let current = "";
    let inBacktick = false;
    let escaped = false;

    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];

        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            current += char;
            continue;
        }

        if (char === "`") {
            inBacktick = !inBacktick;
            current += char;
            continue;
        }

        if (char === "|" && !inBacktick) {
            cells.push(current);
            current = "";
            continue;
        }

        current += char;
    }
    cells.push(current);

    const result = cells.map((c) => c.trim());
    if (trimmed.startsWith("|") && result.length > 0 && result[0] === "") {
        result.shift();
    }
    if (
        trimmed.endsWith("|") &&
        !trimmed.endsWith("\\|") &&
        result.length > 0 &&
        result[result.length - 1] === ""
    ) {
        result.pop();
    }

    return result;
}

/**
 * Validates if a line is a Markdown table delimiter line (e.g. |---|---| or :---:|---:).
 */
export function isTableDelimiter(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (!DELIMITER_CHAR_REGEX.test(trimmed)) return false;
    if (!trimmed.includes("-")) return false;

    const cells = splitCells(trimmed);
    if (cells.length === 0) return false;

    return cells.every((cell) => /^:?-+:?$/.test(cell));
}

/**
 * Extracts column alignments from delimiter cells.
 */
function parseAlignments(
    delimiterCells: string[],
): ("left" | "center" | "right" | "none")[] {
    return delimiterCells.map((cell) => {
        const left = cell.startsWith(":");
        const right = cell.endsWith(":");
        if (left && right) return "center";
        if (left) return "left";
        if (right) return "right";
        return "none";
    });
}

/**
 * Checks if a line starts a new table row or is a continuation line.
 */
function startsNewTableRow(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) return true;

    // Line does not start with pipe: check if it has internal pipes
    const cells = splitCells(trimmed);
    return cells.length >= 2;
}

/**
 * Parses markdown string into an AST.
 */
export function parseMarkdownToAst(markdown: string): MarkdownAst {
    const lines = markdown.split(/\r?\n/);
    const children: MarkdownBlockNode[] = [];
    let paragraphBuffer: string[] = [];

    function flushParagraph(): void {
        if (paragraphBuffer.length === 0) return;
        const content = paragraphBuffer.join("\n");
        paragraphBuffer = [];
        if (content.length > 0) {
            children.push({
                type: "paragraph",
                content,
            });
        }
    }

    let i = 0;
    while (i < lines.length) {
        const line = lines[i]!;

        // 1. Code Block Fence Check
        const fenceMatch = line.trim().match(FENCE_START_REGEX);
        if (fenceMatch) {
            flushParagraph();
            const fence = fenceMatch[1]!;
            const fenceChar = fence[0]!;
            const fenceLen = fence.length;
            const lang = fenceMatch[2]?.trim() || undefined;

            const codeLines: string[] = [];
            i++;
            while (i < lines.length) {
                const codeLine = lines[i]!;
                const trimmedCodeLine = codeLine.trim();
                if (
                    trimmedCodeLine.startsWith(fenceChar.repeat(fenceLen)) &&
                    !trimmedCodeLine.slice(fenceLen).includes("`")
                ) {
                    break;
                }
                codeLines.push(codeLine);
                i++;
            }

            children.push({
                type: "code_block",
                fence,
                lang,
                content: codeLines.join("\n"),
            });
            i++;
            continue;
        }

        // 2. Table Delimiter Check (looking back to previous line in paragraphBuffer)
        if (isTableDelimiter(line) && paragraphBuffer.length > 0) {
            const potentialHeaderLine = paragraphBuffer.pop()!;
            const headerCells = splitCells(potentialHeaderLine);
            const delimiterCells = splitCells(line);

            if (headerCells.length > 0 && delimiterCells.length > 0) {
                // Legitimate table detected
                flushParagraph();

                const alignments = parseAlignments(delimiterCells);
                const expectedCols = Math.max(headerCells.length, delimiterCells.length);

                while (headerCells.length < expectedCols) {
                    headerCells.push(`欄位 ${headerCells.length + 1}`);
                }

                const tableNode: TableNode = {
                    type: "table",
                    headers: headerCells,
                    alignments,
                    rows: [],
                };

                i++;
                let currentRow: string[] | null = null;

                while (i < lines.length) {
                    const rowLine = lines[i]!;
                    const trimmedRowLine = rowLine.trim();

                    // Blank line ends the table
                    if (trimmedRowLine === "") {
                        if (currentRow) {
                            tableNode.rows.push(currentRow);
                            currentRow = null;
                        }
                        break;
                    }

                    // Code fence or heading ends the table
                    if (
                        FENCE_START_REGEX.test(trimmedRowLine) ||
                        HEADING_REGEX.test(trimmedRowLine)
                    ) {
                        if (currentRow) {
                            tableNode.rows.push(currentRow);
                            currentRow = null;
                        }
                        i--; // Re-evaluate in outer loop
                        break;
                    }

                    if (startsNewTableRow(rowLine)) {
                        if (currentRow) {
                            tableNode.rows.push(currentRow);
                        }

                        const cells = splitCells(rowLine);
                        while (cells.length < expectedCols) {
                            cells.push("");
                        }
                        currentRow = cells.slice(0, expectedCols);
                    } else if (currentRow) {
                        // Continuation of the last cell in the current row
                        const cleanedContinuation = trimmedRowLine
                            .replace(/\|$/, "")
                            .trimEnd();

                        const lastIdx = currentRow.length - 1;
                        currentRow[lastIdx] = currentRow[lastIdx]
                            ? `${currentRow[lastIdx]}\n${cleanedContinuation}`
                            : cleanedContinuation;
                    } else {
                        // Not part of table, break
                        break;
                    }

                    i++;
                }

                if (currentRow) {
                    tableNode.rows.push(currentRow);
                }

                children.push(tableNode);
                i++;
                continue;
            } else {
                // Restore if not a table
                paragraphBuffer.push(potentialHeaderLine);
            }
        }

        paragraphBuffer.push(line);
        i++;
    }

    flushParagraph();

    return {
        type: "root",
        children,
    };
}

/**
 * Checks if a string contains Chinese characters.
 */
function hasChinese(str: string): boolean {
    return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * Transforms a single TableNode into a Discord-friendly Markdown list.
 */
export function formatTableAsDiscordList(table: TableNode): string {
    const { headers, rows } = table;

    if (rows.length === 0) {
        return headers.map((h) => `- **${h}**`).join("\n");
    }

    // 2-column tables (most common Key-Value / Overview tables)
    if (headers.length === 2) {
        const isGenericKeyHeader =
            /^(項目|屬性|名稱|欄位|特點|指標|規格|鍵|參數|類別|選項|key|name|property|attribute|field|param|feature|metric|type|item)$/i.test(
                headers[0]?.trim() || "",
            );
        const isGenericValHeader =
            /^(內容|說明|描述|數值|值|設定|細節|備註|value|description|content|desc|val|detail|details|note|notes)$/i.test(
                headers[1]?.trim() || "",
            );

        const isKeyValueTable = isGenericKeyHeader || isGenericValHeader;

        return rows
            .map((row) => {
                const col0 = row[0]?.trim() || "";
                const col1 = row[1]?.trim() || "";

                if (!col1) {
                    return `- **${col0}**`;
                }

                if (!isKeyValueTable) {
                    // Non-generic 2-column header (e.g. 方案 A | 方案 B)
                    const sep0 = hasChinese(headers[0]!) ? "：" : ": ";
                    const sep1 = hasChinese(headers[1]!) ? "：" : ": ";
                    return `- **${headers[0]}**${sep0}${col0}\n  - **${headers[1]}**${sep1}${col1}`;
                }

                const sep = hasChinese(col0) ? "：" : ": ";
                const lines = col1.split("\n");

                // Check if col1 begins with bullet list (- / * / +) or numbered list (1. / 2.)
                const startsWithList = /^([-*+]\s+|\d+\.\s+)/.test(lines[0]!.trim());

                if (startsWithList) {
                    const indented = lines
                        .map((l) => (l.trim() ? `  ${l}` : ""))
                        .join("\n");
                    return `- **${col0}**${sep}\n${indented}`;
                }

                if (lines.length > 1) {
                    const firstLine = lines[0]!.trim();
                    const restIndented = lines
                        .slice(1)
                        .map((l) => (l.trim() ? `  ${l}` : ""))
                        .join("\n");
                    return `- **${col0}**${sep}${firstLine}\n${restIndented}`;
                }

                return `- **${col0}**${sep}${col1}`;
            })
            .join("\n");
    }

    // 3 or more columns
    if (headers.length >= 3) {
        return rows
            .map((row) => {
                const title = row[0]?.trim() || headers[0] || "項目";
                const subItems = headers
                    .slice(1)
                    .map((header, idx) => {
                        const val = row[idx + 1]?.trim() || "—";
                        const sep = hasChinese(header) ? "：" : ": ";
                        const lines = val.split("\n");

                        if (lines.length > 1) {
                            const first = lines[0]!.trim();
                            const rest = lines
                                .slice(1)
                                .map((l) => (l.trim() ? `    ${l}` : ""))
                                .join("\n");
                            return `  - **${header}**${sep}${first}\n${rest}`;
                        }

                        return `  - **${header}**${sep}${val}`;
                    })
                    .join("\n");

                return `- **${title}**\n${subItems}`;
            })
            .join("\n");
    }

    // Single column table
    return rows.map((r) => `- **${r[0]?.trim() || ""}**`).join("\n");
}

/**
 * Serializes the AST back to Markdown text, replacing TableNode with Discord lists.
 */
export function serializeMarkdownAst(ast: MarkdownAst): string {
    const blocks: string[] = [];

    for (const node of ast.children) {
        if (node.type === "code_block") {
            const lang = node.lang || "";
            blocks.push(`${node.fence}${lang}\n${node.content}\n${node.fence}`);
        } else if (node.type === "table") {
            blocks.push(formatTableAsDiscordList(node));
        } else if (node.type === "paragraph") {
            blocks.push(node.content);
        }
    }

    return blocks.join("\n\n");
}

/**
 * Transforms all Markdown tables in text to Discord-formatted lists using AST.
 */
export function convertMarkdownTablesToDiscordLists(text: string): string {
    if (!text || !text.includes("|")) {
        return text;
    }

    const ast = parseMarkdownToAst(text);

    // If there are no tables in the AST, return original text unchanged
    const hasTable = ast.children.some((node) => node.type === "table");
    if (!hasTable) {
        return text;
    }

    return serializeMarkdownAst(ast);
}
