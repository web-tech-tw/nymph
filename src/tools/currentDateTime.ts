import { DynamicStructuredTool } from "@langchain/community/tools/dynamic";
import { z } from "zod";
import dayjs from "dayjs";
import dayjsUtc from "dayjs/plugin/utc.js";
import dayjsTimezone from "dayjs/plugin/timezone.js";

const timeFormat = [
    "[In time zone ]Z[, the date of today and current time are as follow:]",
    "[Date Year: ]YYYY",
    "[Date Month: ]MM",
    "[Date Day: ]DD",
    "[Week Day: ]dddd",
    "[Time Hour: ]HH",
    "[Time Minute: ]mm",
    "[Time Second: ]ss",
].join("\n");

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

/**
 * Create a DynamicStructuredTool
 * that returns the current date/time in a timezone.
 */
export function createCurrentDateTime() {
    return new DynamicStructuredTool({
        name: "CurrentDateTime",
        description: "Returns the current date and time.",
        schema: z.object({
            input: z.string().describe("time zone").default("Asia/Taipei"),
        }),
        func: (query: any) => {
            const { input } = query || {};
            const timeZone = input ?? "Asia/Taipei";

            const nowUtc = dayjs();
            const nowLocal = dayjs.tz(nowUtc, timeZone);
            return nowLocal.format(timeFormat);
        },
    });
}
