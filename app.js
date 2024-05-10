"use strict";

require("dotenv").config();

const runners = [];

if (process.env.MATRIX_ACCESS_TOKEN) {
    runners.push(require("./src/matrix"));
}
if (process.env.DISCORD_BOT_TOKEN) {
    runners.push(require("./src/discord"));
}

Promise.all(runners.map(
    (runner) => runner(),
)).then(() => {
    console.info("Nymph 系統 成功啟動");
}).catch((e) => {
    console.error("Nymph 系統 啟動失敗：", e);
});
