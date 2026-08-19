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
