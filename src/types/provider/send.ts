import type Sender from "../sender.ts";
import type { BaseProvider } from "./index.ts";

export interface SendTextParameters {
    sender?: Sender;
    chatId: string;
    text: string;
}

export interface SendImageParameters {
    sender?: Sender;
    chatId: string;
    imageBuffer: Buffer;
}

export interface SendImageUrlParameters {
    sender?: Sender;
    chatId: string;
    imageUrl: string;
}

export interface SendProvider extends BaseProvider {
    ensure(): Promise<void>;
    text(params: SendTextParameters): Promise<void>;
    image?(params: SendImageParameters): Promise<void>;
    imageUrl?(params: SendImageUrlParameters): Promise<void>;
}
