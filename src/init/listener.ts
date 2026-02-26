
import {getMust} from "../config.ts";

import {
    PLATFORM_LINE,
    PLATFORM_MATRIX,
    PLATFORM_DISCORD,
} from "./const.ts";

import * as line from "../listeners/line/index.ts";
import * as matrix from "../listeners/matrix/index.ts";
import * as discord from "../listeners/discord/index.ts";

export const isEnabled: Record<string, boolean> = {
    [PLATFORM_LINE]: !!getMust("LINE_CHANNEL_ACCESS_TOKEN"),
    [PLATFORM_MATRIX]: !!getMust("MATRIX_PASSWORD"),
    [PLATFORM_DISCORD]: !!getMust("DISCORD_BOT_TOKEN"),
};

export const listeners: Record<string, any> = {
    [PLATFORM_LINE]: line,
    [PLATFORM_MATRIX]: matrix,
    [PLATFORM_DISCORD]: discord,
};

export const prepare = () => {
    for (const platform of Object.keys(isEnabled)) {
        if (isEnabled[platform]) {
            listeners[platform].prepare();
        }
    }
};

export const listen = () => {
    for (const platform of Object.keys(isEnabled)) {
        if (isEnabled[platform]) {
            listeners[platform].listen();
        }
    }
};
