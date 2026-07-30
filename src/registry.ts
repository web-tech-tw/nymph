import { Router } from "express";
import type { ProviderType } from "./config.ts";
import type { SendProvider } from "./types/provider/send.ts";
import type { ListenProvider } from "./types/provider/listen.ts";
import type { HookProvider } from "./types/provider/hook.ts";
import type Sender from "./types/sender.ts";
import { getRelayConfigs } from "./config.ts";

export const sendProviders = new Map<ProviderType, SendProvider>();
export const listenProviders = new Map<ProviderType, ListenProvider>();
export const hookProviders = new Map<ProviderType, HookProvider>();

export const hookRouter = Router();

export async function registerSendProviders(providers: SendProvider[]): Promise<void> {
    for (const provider of providers) {
        if (!provider.enabled) continue;
        await provider.ensure();
        sendProviders.set(provider.type, provider);
        console.info(`[Registry]: Registered SendProvider "${provider.name}"`);
    }
}

export async function registerListenProviders(providers: ListenProvider[]): Promise<void> {
    for (const provider of providers) {
        if (!provider.enabled) continue;
        await provider.listen();
        listenProviders.set(provider.type, provider);
        console.info(`[Registry]: Registered ListenProvider "${provider.name}"`);
    }
}

export async function registerHookProviders(providers: HookProvider[]): Promise<void> {
    for (const provider of providers) {
        if (!provider.enabled) continue;
        hookProviders.set(provider.type, provider);
        hookRouter.use(provider.router);
        console.info(`[Registry]: Registered HookProvider "${provider.name}"`);
    }
}

export async function sendText(targetPlatform: ProviderType, chatId: string, text: string, sender?: Sender): Promise<void> {
    const provider = sendProviders.get(targetPlatform);
    if (!provider) {
        console.warn(`[Registry]: SendProvider "${targetPlatform}" is not enabled or registered`);
        return;
    }
    await provider.text({ chatId, text, sender });
}

export async function broadcast(originPlatform: ProviderType, chatId: string, text: string, sender?: Sender): Promise<void> {
    const relays = getRelayConfigs();
    const group = relays.find((r: Record<string, string>) => r[originPlatform] === chatId);
    if (!group) return;

    const promises: Promise<void>[] = [];
    for (const [platformKey, targetRoomId] of Object.entries(group)) {
        if (platformKey === originPlatform || !targetRoomId) continue;
        const provider = sendProviders.get(platformKey as ProviderType);
        if (provider) {
            promises.push(provider.text({ chatId: targetRoomId, text, sender }));
        }
    }
    await Promise.allSettled(promises);
}
