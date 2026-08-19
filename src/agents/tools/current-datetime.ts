import { tool } from "ai";
import { z } from "zod";
import dayjs from "dayjs";
import dayjsUtc from "dayjs/plugin/utc.js";
import dayjsTimezone from "dayjs/plugin/timezone.js";

dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);

export const toolCurrentDateTime = () => {
    return tool({
        description:
            "Get the current date, time, weekday, and timezone information.",
        inputSchema: z.object({
            timezone: z
                .string()
                .default("Asia/Taipei")
                .describe("IANA timezone identifier (default: 'Asia/Taipei')."),
        }),
        execute: async ({ timezone = "Asia/Taipei" }) => {
            const tz = timezone || "Asia/Taipei";
            const now = dayjs.tz(dayjs(), tz);

            const dateStr = now.format("YYYY-MM-DD");
            const timeStr = now.format("HH:mm:ss");
            const weekday = now.format("dddd");
            const year = now.format("YYYY");
            const month = now.format("MM");
            const day = now.format("DD");
            const hour = now.format("HH");
            const minute = now.format("mm");
            const second = now.format("ss");
            const iso = now.toISOString();

            return [
                `<current_datetime timezone="${tz}">`,
                `  <date year="${year}" month="${month}" day="${day}" weekday="${weekday}">${dateStr}</date>`,
                `  <time hour="${hour}" minute="${minute}" second="${second}">${timeStr}</time>`,
                `  <formatted>${dateStr} ${timeStr} (${weekday})</formatted>`,
                `  <iso>${iso}</iso>`,
                "</current_datetime>",
            ].join("\n");
        },
    });
};
