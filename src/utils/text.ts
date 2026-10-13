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

export function sliceContent(content: string, limit = 2000): string[] {
    if (!content) return [];
    if (content.length <= limit) return [content];

    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > 0) {
        if (remaining.length <= limit) {
            chunks.push(remaining);
            break;
        }

        let sliceIndex = remaining.lastIndexOf("\n", limit);
        if (sliceIndex === -1 || sliceIndex === 0) {
            sliceIndex = remaining.lastIndexOf(" ", limit);
        }
        if (sliceIndex === -1 || sliceIndex === 0) {
            sliceIndex = limit;
        }

        chunks.push(remaining.slice(0, sliceIndex).trim());
        remaining = remaining.slice(sliceIndex).trim();
    }

    return chunks.filter((c) => c.length > 0);
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
 * Truncates tool execution result if it exceeds maxTokens.
 */
export function truncateToolResult(result: unknown, maxTokens = 4000): unknown {
    if (typeof result === "string") {
        return truncateText(result, maxTokens);
    }
    if (result && typeof result === "object") {
        try {
            const str = JSON.stringify(result);
            if (str.length > maxTokens * 4) {
                return truncateText(str, maxTokens);
            }
        } catch {
            // If circular or unstringifiable, return as-is
        }
    }
    return result;
}

