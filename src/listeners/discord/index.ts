
import {
    useClient,
} from "../../clients/discord.ts";

import {
    Events,
} from "discord.js";

import {
    registerCommands,
} from "./interaction_create/commands.ts";

import clientReady from "./client_ready/index.ts";
import interactionCreate from "./interaction_create/index.ts";
import messageCreate from "./message_create/index.ts";

const triggers: Record<string, any> = {
    [Events.ClientReady]: clientReady,
    [Events.InteractionCreate]: interactionCreate,
    [Events.MessageCreate]: messageCreate,
};

export const prepare = async () => {
    await registerCommands();
};

export const listen = async () => {
    const client = useClient();
    const triggerEntries = Object.entries(triggers);
    for (const [key, trigger] of triggerEntries) {
        client.on(key, trigger);
    }
};
