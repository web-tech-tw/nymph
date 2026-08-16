export const PlatformName = {
    All: "All",
    Discord: "Discord",
    LINE: "LINE",
} as const;

export type PlatformName = (typeof PlatformName)[keyof typeof PlatformName];

export interface BaseProvider {
    readonly name: PlatformName;
    isEnabled(): Promise<boolean>;
    start(): void | Promise<void>;
    stop(): void | Promise<void>;
    onMessage(ctx: ChatContext): Promise<void>;
    onCommand(command: string, args: string[], ctx: ChatContext): Promise<void>;
}

export interface UserProfile {
    id: string;
    nickname: string;
    [key: string]: unknown;
}

export interface ChatContext {
    platform: PlatformName;
    roomId: string;
    sender: UserProfile;
    content: string;
}
