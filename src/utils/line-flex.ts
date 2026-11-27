import type { messagingApi } from "@line/bot-sdk";
import type { ArxivReplyCard } from "./arxiv";
import type { HelpCardData } from "../types/provider";

const QUICK_REPLIES_TAG_REGEX = /<quick_replies>([\s\S]*?)<\/quick_replies>/gi;
const LINE_ALT_TEXT_MAX = 400;
const LINE_QUICK_REPLY_LABEL_MAX = 20;
const LINE_QUICK_REPLY_TEXT_MAX = 300;
const MAX_AI_QUICK_REPLIES = 3;

function truncateText(text: string, maxLen: number): string {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, Math.max(1, maxLen - 1))}…`;
}

function isValidHttpUrl(url?: string): url is string {
    if (!url) return false;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

/**
 * Extracts and strips <quick_replies>...</quick_replies> tags from model output.
 * Always removes the tag so raw XML never leaks into replies or chat history.
 */
export function extractQuickRepliesTag(text: string): { cleanText: string; quickReplies: string[] } {
    if (!text) return { cleanText: "", quickReplies: [] };

    const suggestions: string[] = [];
    const seen = new Set<string>();

    const cleanText = text.replace(QUICK_REPLIES_TAG_REGEX, (_match, inner: string) => {
        const parts = inner
            .split(/[|\n]/)
            .map((item) => item.replace(/^[-•*\d.)\s]+/, "").trim())
            .filter(Boolean);

        for (const part of parts) {
            if (suggestions.length >= MAX_AI_QUICK_REPLIES) break;
            const key = part.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                suggestions.push(truncateText(part, LINE_QUICK_REPLY_TEXT_MAX));
            }
        }
        return "";
    }).trim();

    return { cleanText, quickReplies: suggestions };
}

function makeMessageQuickReplyItem(label: string, text: string): messagingApi.QuickReplyItem {
    return {
        type: "action",
        action: {
            type: "message",
            label: truncateText(label, LINE_QUICK_REPLY_LABEL_MAX),
            text: truncateText(text, LINE_QUICK_REPLY_TEXT_MAX),
        },
    };
}

/**
 * Builds contextual Quick Reply recommended follow-ups attached to the last LINE replyMessage bubble.
 */
export function buildLineQuickReply(options: {
    converged?: boolean;
    isArxiv?: boolean;
    isSystemCard?: boolean;
    suggestions?: string[];
} = {}): messagingApi.QuickReply {
    const items: messagingApi.QuickReplyItem[] = [];

    if (options.converged) {
        items.push(
            makeMessageQuickReplyItem("▶️ 繼續深入查證", "請繼續剛才未完成的查證並補充細節"),
        );
        return { items };
    }

    if (options.isArxiv) {
        items.push(
            makeMessageQuickReplyItem("🧪 方法與架構", "請進一步說明這篇論文的實驗方法與核心架構"),
            makeMessageQuickReplyItem("⚖️ 限制與風險", "這篇論文的主要限制與實務落地風險是什麼？"),
        );
        return { items };
    }

    if (options.isSystemCard) {
        items.push(
            makeMessageQuickReplyItem("💡 架構選型建議", "請幫我評估前端專案的技術選型重點"),
            makeMessageQuickReplyItem("🔍 查社群技術知識", "請搜尋社群知識庫近期常見的除錯經驗"),
        );
        return { items };
    }

    const aiSuggestions = (options.suggestions || []).filter(Boolean).slice(0, MAX_AI_QUICK_REPLIES);
    if (aiSuggestions.length > 0) {
        for (const suggestion of aiSuggestions) {
            items.push(makeMessageQuickReplyItem(suggestion, suggestion));
        }
    } else {
        items.push(
            makeMessageQuickReplyItem("💡 舉個實例", "請針對上述重點舉一個實際範例"),
            makeMessageQuickReplyItem("📝 深入說明", "請針對上述內容做更深入的技術說明"),
        );
    }

    return { items };
}

/**
 * Builds a LINE Flex Bubble card for an arXiv paper summary.
 */
export function buildArxivFlexMessage(card: ArxivReplyCard): messagingApi.FlexMessage {
    const title = card.title.trim() || "arXiv 論文速覽";
    const summary = card.summary.trim() || "—";
    const comment = card.comment.trim();
    const validUrl = isValidHttpUrl(card.url) ? card.url.trim() : undefined;

    const bodyContents: messagingApi.FlexComponent[] = [
        {
            type: "text",
            text: title,
            weight: "bold",
            size: "md",
            color: "#111827",
            wrap: true,
        },
        {
            type: "text",
            text: summary,
            size: "sm",
            color: "#374151",
            wrap: true,
            margin: "md",
        },
    ];

    if (comment) {
        bodyContents.push(
            {
                type: "separator",
                margin: "lg",
            },
            {
                type: "text",
                text: "心得",
                weight: "bold",
                size: "xs",
                color: "#B31B1B",
                margin: "md",
            },
            {
                type: "text",
                text: comment,
                size: "sm",
                color: "#4B5563",
                wrap: true,
                margin: "xs",
            },
        );
    }

    const bubble: messagingApi.FlexBubble = {
        type: "bubble",
        header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#B31B1B",
            paddingAll: "12px",
            contents: [
                {
                    type: "text",
                    text: "arXiv 論文速覽",
                    color: "#FFFFFF",
                    weight: "bold",
                    size: "sm",
                },
            ],
        },
        body: {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            contents: bodyContents,
        },
        ...(validUrl
            ? {
                footer: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "12px",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            color: "#B31B1B",
                            height: "sm",
                            action: {
                                type: "uri",
                                label: "閱讀論文原文",
                                uri: validUrl,
                            },
                        },
                    ],
                },
            }
            : {}),
    };

    return {
        type: "flex",
        altText: truncateText(`arXiv 論文速覽：${title}`, LINE_ALT_TEXT_MAX),
        contents: bubble,
    };
}

/**
 * Builds a LINE Flex Bubble card for /help.
 */
export function buildHelpFlexMessage(data: HelpCardData = {}): messagingApi.FlexMessage {
    const tokensUrl = data.baseUrl
        ? `${data.baseUrl.replace(/\/+$/, "")}/mcp/tokens`
        : undefined;
    const validTokensUrl = isValidHttpUrl(tokensUrl) ? tokensUrl : undefined;

    const bubble: messagingApi.FlexBubble = {
        type: "bubble",
        header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#0284C7",
            paddingAll: "12px",
            contents: [
                {
                    type: "text",
                    text: "Nymph 使用指南",
                    color: "#FFFFFF",
                    weight: "bold",
                    size: "sm",
                },
            ],
        },
        body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            paddingAll: "16px",
            contents: [
                {
                    type: "text",
                    text: "• 直接提問或傳送圖片，結合社群知識庫與工具協助診斷分析。",
                    size: "sm",
                    color: "#374151",
                    wrap: true,
                },
                {
                    type: "text",
                    text: "• 貼上 arXiv 論文網址即可自動產生論文速覽卡片。",
                    size: "sm",
                    color: "#374151",
                    wrap: true,
                },
                {
                    type: "text",
                    text: "• 透過下方推薦追問按鈕可快速深入探討相關技術細節。",
                    size: "sm",
                    color: "#374151",
                    wrap: true,
                },
            ],
        },
        ...(validTokensUrl
            ? {
                footer: {
                    type: "box",
                    layout: "vertical",
                    paddingAll: "12px",
                    contents: [
                        {
                            type: "button",
                            style: "primary",
                            color: "#0284C7",
                            height: "sm",
                            action: {
                                type: "uri",
                                label: "MCP 權杖管理",
                                uri: validTokensUrl,
                            },
                        },
                    ],
                },
            }
            : {}),
    };

    return {
        type: "flex",
        altText: "Nymph 使用指南：技術諮詢、圖片分析與 arXiv 論文速覽",
        contents: bubble,
    };
}
