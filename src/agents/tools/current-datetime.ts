import { tool } from "ai";
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

export const toolCurrentDateTime = () => {
    return tool(
        {
            description: "Returns the current date and time.",
            inputSchema: z.object({
                input: z.string().describe("time zone").default("Asia/Taipei"),
            }),
            execute: async ({ input }: { input: string }) => {
                const tz = input || "Asia/Taipei";
                return dayjs.tz(dayjs(), tz).format(TIME_FORMAT);
            },
        },
    );
};
