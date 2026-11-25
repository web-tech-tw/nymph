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

function flushBuffer(
    buffer: string,
    openFence: FenceState | null,
    separator: string,
    snippets: string[],
): void {
    const text = openFence ? `${buffer}${separator}${openFence.marker}` : buffer;
    if (text.trim()) {
        snippets.push(text.trim());
    }
}

/**
 * Splits content into chunks of at most `maxLength` characters while preserving
 * line breaks and keeping Markdown fenced code blocks balanced across chunks.
 */
export function sliceContent(content: string, maxLength: number, separator = "\n"): string[] {
    if (!content.trim()) return [];
    if (maxLength <= 0) return [content];

    const parts = content.split(separator);
    const snippets: string[] = [];
    const trackFences = separator === "\n";

    let buffer = "";
    let openFence: FenceState | null = null;

    for (const part of parts) {
        const nextFence: FenceState | null = trackFences ? updateFenceState(part, openFence) : null;
        const nextReserve = nextFence ? separator.length + nextFence.marker.length : 0;

        if (buffer.length > 0) {
            const candidate = `${buffer}${separator}${part}`;
            if (candidate.length + nextReserve <= maxLength) {
                buffer = candidate;
                openFence = nextFence;
                continue;
            }

            flushBuffer(buffer, openFence, separator, snippets);
            buffer = openFence ? `${openFence.header}${separator}` : "";
        }

        if (buffer.length + part.length + nextReserve <= maxLength) {
            buffer += part;
            openFence = nextFence;
            continue;
        }

        // Single line exceeds maxLength: split it across chunks while respecting fence overhead.
        let remaining = part;
        while (remaining.length > 0) {
            const currentReserve = openFence ? separator.length + openFence.marker.length : 0;
            const avail = Math.max(1, maxLength - buffer.length - currentReserve);

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

            flushBuffer(buffer, openFence, separator, snippets);
            buffer = openFence ? `${openFence.header}${separator}` : "";
        }

        openFence = nextFence;
    }

    if (buffer.trim()) {
        snippets.push(buffer.trim());
    }

    return snippets;
}
