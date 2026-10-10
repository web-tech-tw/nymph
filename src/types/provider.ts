export const PlatformName = {
    Global: "Global",
    Discord: "Discord",
    LINE: "LINE",
    MCP: "MCP",
} as const;

export type PlatformName = (typeof PlatformName)[keyof typeof PlatformName];

export type MessageCallback = (ctx: ChatContext) => Promise<void>;
export type CommandCallback = (command: string, args: string[], ctx: ChatContext) => Promise<void>;

export interface BaseGlobalProvider extends BaseProvider {
    sendText(roomId: string, content: string, platformName?: PlatformName): void | Promise<void>;
}

export interface BasePlatformProvider extends BaseProvider {
    sendText(roomId: string, content: string): void | Promise<void>;
}

export interface BaseProvider {
    readonly name: PlatformName;
    readonly enabled: boolean;
    start(): void | Promise<void>;
    stop(): void | Promise<void>;
    onMessage(cb: MessageCallback): void;
    onCommand(cb: CommandCallback): void;
}

export interface UserProfile {
    id: string;
    nickname: string;
    [key: string]: unknown;
}

export type MessageContentType = "text" | "image";

/**
 * Context about the message this message replies to (Discord reply, etc.).
 * Injected into the current turn's prompt only; never persisted to history.
 */
export interface ReplyToContext {
    author: string;
    content: string;
}

export interface ChatContext {
    platformName: PlatformName;
    roomId: string;
    sender: UserProfile;
    type: MessageContentType;
    content: string;
    replyTo?: ReplyToContext;
    reply(content: string): Promise<void>;
}
