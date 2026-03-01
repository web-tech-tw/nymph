import type { Request, Response, NextFunction } from "express";

export const Platform = {
    Discord: "Discord",
    LINE: "LINE",
    Matrix: "Matrix",
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

export interface AuthMetadata {
    profile?: UserProfile;
    error?: string;
    [key: string]: unknown;
}

export interface UserProfile {
    _id?: string;
    nickname?: string;
    email?: string;
    roles?: string[];
    [key: string]: unknown;
}

export interface AuthPayload {
    id: string | null;
    method: string;
    secret: string;
    metadata: AuthMetadata | null;
}

export interface AuthenticatedRequest extends Request {
    auth?: AuthPayload;
}

export interface TokenValidationResult {
    userId: string | null;
    payload: AuthMetadata | null;
    isAborted: boolean;
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export interface ProtocolInfo {
    protocol: "http" | "https";
    hostname: string;
    port: number;
}

export interface ChatContext {
    platform: Platform;
    roomId: string;
    senderId?: string;
    senderName?: string;
    content: string;
}

export type RelayEntry = Partial<Record<Platform, string>>;

export const RoomMode = {
    Normal: "normal",
    Translator: "translator",
} as const;

export type RoomMode = (typeof RoomMode)[keyof typeof RoomMode];
