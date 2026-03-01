import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import dayjs from "dayjs";
import dayjsUtc from "dayjs/plugin/utc.js";
import dayjsTimezone from "dayjs/plugin/timezone.js";

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

const TIME_FORMAT = [
    "[In time zone ]Z[, the date of today and current time are as follow:]",
    "[Date Year: ]YYYY",
    "[Date Month: ]MM",
    "[Date Day: ]DD",
    "[Week Day: ]dddd",
    "[Time Hour: ]HH",
    "[Time Minute: ]mm",
    "[Time Second: ]ss",
].join("\n");

export function createCurrentDateTime(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "CurrentDateTime",
        description: "Returns the current date and time.",
        schema: z.object({
            input: z.string().describe("time zone").default("Asia/Taipei"),
        }),
        func: async ({ input }: { input: string }) => {
            const tz = input || "Asia/Taipei";
            return dayjs.tz(dayjs(), tz).format(TIME_FORMAT);
        },
    });
}
