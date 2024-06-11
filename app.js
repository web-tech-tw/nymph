"use strict";

const {
    runLoader,
    getMust,
    get,
} = require("./src/config");
const {
    prepare,
} = require("./src/clients/database");
const express = require("express");

runLoader();

const app = express();

const runners = [];
if (get("LINE_CHANNEL_SECRET")) {
    app.use("/line", require("./src/line")());
}
if (get("DISCORD_BOT_TOKEN")) {
    runners.push(require("./src/discord"));
}
if (get("MATRIX_USERNAME")) {
    runners.push(require("./src/matrix"));
}

(async () => {
    await prepare();
    await Promise.all(runners.map(
        (runner) => runner(),
    )).then(() => {
        console.info("Nymph 系統 成功啟動");
    }).catch((e) => {
        console.error("Nymph 系統 啟動失敗：", e);
    });
})();

app.listen(getMust("HTTP_PORT"));
