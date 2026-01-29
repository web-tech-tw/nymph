"use strict";

const {
    DynamicStructuredTool,
} = require("@langchain/community/tools/dynamic");
const {
    z,
} = require("zod");

const dayjs = require("dayjs");
const dayjsUtc = require("dayjs/plugin/utc");
const dayjsTimezone = require("dayjs/plugin/timezone");

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
 * @return {DynamicStructuredTool}
 */
function createCurrentDateTime() {
    return new DynamicStructuredTool({
        name: "CurrentDateTime",
        description: "Returns the current date and time.",
        schema: z.object({
            input: z.string().describe("time zone").default("Asia/Taipei"),
        }),
        func: (query) => {
            const {input} = query || {};
            const timeZone = input ?? "Asia/Taipei";

            const nowUtc = dayjs();
            const nowLocal = dayjs.tz(nowUtc, timeZone);
            return nowLocal.format(timeFormat);
        },
    });
}

module.exports = {
    createCurrentDateTime,
};
