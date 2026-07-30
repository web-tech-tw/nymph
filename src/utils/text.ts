import fs from "node:fs";
import readline from "node:readline";

export async function* readLines(path: string): AsyncGenerator<string> {
    const fileStream = fs.createReadStream(path, {encoding: "utf8"});
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        yield line;
    }
}
