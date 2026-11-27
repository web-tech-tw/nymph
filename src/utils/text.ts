export async function* readLines(path: string): AsyncGenerator<string> {
    const stream = Bun.file(path).stream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let leftover = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = leftover + decoder.decode(value, { stream: true });
        const lines = chunk.split(/\r?\n/);
        leftover = lines.pop() ?? "";

        for (const line of lines) {
            yield line;
        }
    }

    leftover += decoder.decode();
    if (leftover.length > 0) {
        yield leftover;
    }
}

interface FenceState {
    marker: string;
    header: string;
}

function updateFenceState(line: string, current: FenceState | null): FenceState | null {
    const trimmed = line.trim();
    if (!current) {
        const openMatch = /^(`{3,})([^`]*)$/.exec(trimmed);
        if (openMatch) {
            return { marker: openMatch[1], header: trimmed };
        }
        return null;
    }

    const closeMatch = /^(`{3,})$/.exec(trimmed);
    if (closeMatch && closeMatch[1].length >= current.marker.length) {
        return null;
    }
    return current;
}

function flushSliceBuffer(
    buffer: string,
    openFence: FenceState | null,
    chunks: string[],
): void {
    const text = openFence ? `${buffer}\n${openFence.marker}` : buffer;
    if (text.trim()) {
        chunks.push(text.trim());
    }
}

export function sliceContent(content: string, limit = 2000): string[] {
    if (!content.trim()) return [];
    if (limit <= 0 || content.length <= limit) return [content];

    const lines = content.split("\n");
    const chunks: string[] = [];
    let buffer = "";
    let openFence: FenceState | null = null;

    for (const line of lines) {
        const nextFence: FenceState | null = updateFenceState(line, openFence);
        const nextReserve = nextFence ? 1 + nextFence.marker.length : 0;

        if (buffer.length > 0) {
            const candidate = `${buffer}\n${line}`;
            if (candidate.length + nextReserve <= limit) {
                buffer = candidate;
                openFence = nextFence;
                continue;
            }

            flushSliceBuffer(buffer, openFence, chunks);
            buffer = openFence ? `${openFence.header}\n` : "";
        }

        if (buffer.length + line.length + nextReserve <= limit) {
            buffer += line;
            openFence = nextFence;
            continue;
        }

        let remaining = line;
        while (remaining.length > 0) {
            const currentReserve = openFence ? 1 + openFence.marker.length : 0;
            const avail = Math.max(1, limit - buffer.length - currentReserve);

            if (remaining.length <= avail) {
                buffer += remaining;
                remaining = "";
                break;
            }

            let cut = avail;
            const spaceIdx = remaining.lastIndexOf(" ", avail);
            if (spaceIdx > Math.floor(avail * 0.5)) {
                cut = spaceIdx + 1;
            }

            buffer += remaining.slice(0, cut).trimEnd();
            remaining = remaining.slice(cut).trimStart();

            flushSliceBuffer(buffer, openFence, chunks);
            buffer = openFence ? `${openFence.header}\n` : "";
        }

        openFence = nextFence;
    }

    if (buffer.trim()) {
        chunks.push(buffer.trim());
    }

    return chunks;
}

/**
 * Converts a string from camelCase to snake_case.
 * @param str - The input string in camelCase format.
 * @returns The transformed string in snake_case format.
 */
export function camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) =>
        `_${letter.toLowerCase()}`,
    );
}

/**
 * Converts a camelCase string to snake_case.
 * @param str - The input string in snake_case format.
 * @returns The transformed string in camelCase format.
 */
export function snakeToCamelCase(str: string): string {
    return str.toLowerCase().replace(/([-_][a-z])/g, (group) =>
        group.toUpperCase().replace("-", "").replace("_", ""),
    );
}

/**
 * Sanitizes model reply for chat platforms (Discord/LINE).
 * - Normalizes literal <br> or <br/> tags to real newlines
 * - Strips raw retrieval citation markers like 【1†L1-L5】
 */
export function sanitizeChatReply(text: string): string {
    if (!text) return "";
    return text
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/【\d+†[^】]*】/g, "")
        .trim();
}

/**
 * Estimates token count from a string using a fast heuristic (~4 chars per token).
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil((text.length + 3) / 4);
}

export interface McpContentPart {
    type: string;
    text?: string;
    [key: string]: unknown;
}

export interface McpCallToolResult {
    content: McpContentPart[];
    isError?: boolean;
    [key: string]: unknown;
}

/**
 * Truncates text if its estimated tokens exceed maxTokens.
 */
export function truncateText(text: string, maxTokens = 4000): string {
    if (!text) return "";
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    const est = estimateTokens(text);
    return text.slice(0, maxChars) + `\n... [輸出已省略，共約 ${est} tokens]`;
}

/**
 * Normalizes and truncates MCP tool output so that it is always guaranteed
 * to be a valid object with `{ content: [...] }`.
 * This prevents TypeError in upstream `@ai-sdk/mcp`'s `!('content' in result)` check
 * when tools or wrappers return primitives.
 */
export function normalizeAndTruncateMcpResult(result: unknown, maxTokens = 4000): McpCallToolResult {
    if (result == null) {
        return { content: [{ type: "text", text: "" }] };
    }

    // If it's already an MCP result object with an array of content parts
    if (
        typeof result === "object" &&
        result !== null &&
        "content" in result &&
        Array.isArray((result as { content: unknown }).content)
    ) {
        const rawResult = result as McpCallToolResult;
        const newContent = rawResult.content.map((part) => {
            if (part && typeof part === "object" && typeof part.text === "string") {
                return {
                    ...part,
                    text: truncateText(part.text, maxTokens),
                };
            }
            return part;
        });
        return {
            ...rawResult,
            content: newContent,
        };
    }

    // If it's a string, wrap it as a single text content part
    if (typeof result === "string") {
        return {
            content: [{ type: "text", text: truncateText(result, maxTokens) }],
        };
    }

    // For any other primitive or non-standard object, stringify and wrap
    let textRepr: string;
    try {
        textRepr = typeof result === "object" ? JSON.stringify(result) : String(result);
    } catch {
        textRepr = String(result);
    }

    return {
        content: [{ type: "text", text: truncateText(textRepr, maxTokens) }],
    };
}

/**
 * Truncates tool execution result if it exceeds maxTokens, preserving object structure for MCP.
 */
export function truncateToolResult(result: unknown, maxTokens = 4000): unknown {
    return normalizeAndTruncateMcpResult(result, maxTokens);
}

/**
 * Parses supported slash commands (currently "/help").
 */
export function parseSlashCommand(text: string): { command: string; args: string[] } | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return null;
    const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
    const first = parts[0];
    if (!first) return null;
    const command = first.toLowerCase();
    if (command !== "help") return null;
    return { command, args: parts.slice(1) };
}

