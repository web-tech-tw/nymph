import { describe, expect, test } from "bun:test";
import { getScheduledPromptsFromFile, type ScheduledPromptConfig } from "./index";

describe("Scheduled Prompts Config Parsing", () => {
    test("should return empty array when the config file does not exist", async () => {
        const configs = await getScheduledPromptsFromFile(`/tmp/schedule_missing_${Date.now()}.toml`);
        expect(configs).toEqual([]);
    });

    test("should parse prompts entries with snake_case keys", async () => {
        const tomlContent = `
[[prompts]]
enabled = true
name = "morning-greeting"
time = "0 9 * * *"
channel_id = "123456789012345678"
prompt = "道早安"
`;
        const tmpPath = `/tmp/schedule_test_${Date.now()}.toml`;
        await Bun.write(tmpPath, tomlContent);

        try {
            const configs = await getScheduledPromptsFromFile(tmpPath);
            expect(configs.length).toBe(1);
            expect(configs[0]).toEqual({
                name: "morning-greeting",
                enabled: true,
                time: "0 9 * * *",
                channelId: "123456789012345678",
                prompt: "道早安",
            } satisfies ScheduledPromptConfig);
        } finally {
            await Bun.write(tmpPath, "");
        }
    });

    test("should skip entries missing required fields", async () => {
        const tomlContent = `
[[prompts]]
name = "missing-channel"
time = "0 9 * * *"
prompt = "no channel"

[[prompts]]
name = "missing-prompt"
time = "0 9 * * *"
channel_id = "123"

[[prompts]]
name = "valid"
time = "*/5 * * * *"
channel_id = "123"
prompt = "hello"
`;
        const tmpPath = `/tmp/schedule_test_invalid_${Date.now()}.toml`;
        await Bun.write(tmpPath, tomlContent);

        try {
            const configs = await getScheduledPromptsFromFile(tmpPath);
            expect(configs.length).toBe(1);
            expect(configs[0]?.name).toBe("valid");
        } finally {
            await Bun.write(tmpPath, "");
        }
    });

    test("should return empty array when the config file is unparsable", async () => {
        const tmpPath = `/tmp/schedule_test_broken_${Date.now()}.toml`;
        await Bun.write(tmpPath, "this is not = valid toml [[[");

        try {
            const configs = await getScheduledPromptsFromFile(tmpPath);
            expect(configs).toEqual([]);
        } finally {
            await Bun.write(tmpPath, "");
        }
    });
});
