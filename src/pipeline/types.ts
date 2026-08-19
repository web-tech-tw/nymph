export interface RawMessageDoc {
    _id: string;
    date: string;
    time: string;
    content: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export type MessageType = "message" | "sticker" | "join" | "leave" | "recall" | "system";

export interface ParsedMessage {
    id: string;
    date: string;
    time: string;
    timestampMs: number;
    author: string;
    content: string;
    type: MessageType;
    authorConfident: boolean;
}

export interface MergedMessageBlock {
    date: string;
    startTime: string;
    endTime: string;
    startTimestampMs: number;
    endTimestampMs: number;
    author: string;
    content: string;
    rawMessageIds: string[];
}

export interface DiscussionThread {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    participants: string[];
    messages: MergedMessageBlock[];
}

export interface ExtractedKnowledge {
    category: string;
    topic: string;
    problemBackground: string;
    attemptsAndEvaluations: Array<{
        solution: string;
        status: "accepted" | "rejected" | "investigating";
        reason?: string;
    }>;
    consensus: string;
    actionItems: string[];
    codeSnippetsOrLinks: string[];
    tags: string[];
    sourceDateRange: {
        start: string;
        end: string;
    };
    participants: string[];
    rawMessageCount: number;
}
