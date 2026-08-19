import mongoose from "mongoose";
import { PIPELINE_CONFIG } from "../config";
import type { ExtractedKnowledge } from "../types";
import { KnowledgeModel, type IKnowledgeDocument } from "../../databases/models/knowledge";

/**
 * Format an ExtractedKnowledge item into a structured Markdown chapter slice
 */
export function formatKnowledgeMarkdown(item: ExtractedKnowledge): string {
    const lines: string[] = [];

    lines.push(`### [${item.category}] ${item.topic}`);
    lines.push("");
    lines.push(`**分類**：${item.category} | **標籤**：${item.tags.map((t) => `\`#${t}\``).join(" ")}`);
    lines.push(`**討論時間**：${item.sourceDateRange.start} ~ ${item.sourceDateRange.end}`);
    if (item.participants.length > 0) {
        lines.push(`**參與成員**：${item.participants.join(", ")}`);
    }
    lines.push("");

    // 1. Problem Background
    lines.push("#### 問題背景與現象");
    lines.push(item.problemBackground);
    lines.push("");

    // 2. Attempts & Evaluations
    if (item.attemptsAndEvaluations.length > 0) {
        lines.push("#### 嘗試與評估過程");
        for (const attempt of item.attemptsAndEvaluations) {
            const statusLabel =
                attempt.status === "accepted"
                    ? "採納"
                    : attempt.status === "rejected"
                        ? "否決"
                        : "觀察中";
            lines.push(`* **[${statusLabel}]** ${attempt.solution}`);
            if (attempt.reason) {
                lines.push(`  * *原因*：${attempt.reason}`);
            }
        }
        lines.push("");
    }

    // 3. Consensus & Final Solution
    lines.push("#### 共識結論與解法");
    lines.push(item.consensus);
    lines.push("");

    // 4. Code Snippets & Links
    if (item.codeSnippetsOrLinks.length > 0) {
        lines.push("#### 關鍵程式碼與參考資源");
        for (const snippet of item.codeSnippetsOrLinks) {
            if (snippet.startsWith("http://") || snippet.startsWith("https://")) {
                lines.push(`* 參考連結：<${snippet}>`);
            } else if (snippet.includes("\n") || snippet.startsWith("```")) {
                lines.push(snippet.startsWith("```") ? snippet : `\`\`\`\n${snippet}\n\`\`\``);
            } else {
                lines.push(`* \`${snippet}\``);
            }
        }
        lines.push("");
    }

    // 5. Action Items
    if (item.actionItems.length > 0) {
        lines.push("#### 待辦事項與後續追蹤");
        for (const action of item.actionItems) {
            lines.push(`- [ ] ${action}`);
        }
        lines.push("");
    }

    return lines.join("\n").trim();
}

/**
 * Convert ExtractedKnowledge items into Knowledge documents
 */
export function buildKnowledgeDocuments(
    items: ExtractedKnowledge[],
): IKnowledgeDocument[] {
    return items.map((item) => {
        const text = formatKnowledgeMarkdown(item);
        return {
            text,
            metadata: {
                category: item.category,
                topic: item.topic,
                tags: item.tags,
                sourceDateRange: item.sourceDateRange,
                participants: item.participants,
                rawMessageCount: item.rawMessageCount,
            },
        };
    });
}

/**
 * Load knowledge documents into target MongoDB collection
 */
export async function loadKnowledgeDocuments(
    docs: IKnowledgeDocument[],
    targetUri = PIPELINE_CONFIG.target.uri,
): Promise<{ inserted: number; updated: number }> {
    if (!docs.length) {
        return { inserted: 0, updated: 0 };
    }

    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(targetUri);
    }

    let inserted = 0;
    let updated = 0;

    for (const doc of docs) {
        const filter = {
            "metadata.sourceDateRange.start": doc.metadata.sourceDateRange?.start,
        };

        const result = await KnowledgeModel.updateOne(
            filter,
            { $set: doc },
            { upsert: true },
        );

        if (result.upsertedCount > 0) {
            inserted++;
        } else if (result.modifiedCount > 0) {
            updated++;
        }
    }

    return { inserted, updated };
}
