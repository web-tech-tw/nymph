export interface ParsedFrontMatter {
    meta: Record<string, string | string[]>;
    text: string;
}

function parseValue(raw: string): string | string[] {
    const value = raw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
        const inner = value.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(",").map((item) => unquote(item.trim())).filter(Boolean);
    }
    return unquote(value);
}

function unquote(value: string): string {
    if (
        (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
        return value.slice(1, -1);
    }
    return value;
}

/**
 * Minimal YAML front-matter parser: extracts a leading `---` block and parses
 * `key: value` lines where value is a plain string or a bracketed array.
 * The full original text (front-matter included) is returned unchanged.
 */
export function parseFrontMatter(content: string): ParsedFrontMatter {
    if (!content.startsWith("---\n")) {
        return { meta: {}, text: content };
    }

    const end = content.indexOf("\n---", 4);
    if (end === -1) {
        return { meta: {}, text: content };
    }

    // Allow a trailing `---` at EOF without newline after it
    const block = content.slice(4, end);

    const meta: Record<string, string | string[]> = {};
    for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const sep = trimmed.indexOf(":");
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        const value = trimmed.slice(sep + 1).trim();
        if (!key) continue;
        meta[key] = parseValue(value);
    }

    return { meta, text: content };
}
