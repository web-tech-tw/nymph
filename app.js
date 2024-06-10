"use strict";

const {
    runLoader,
    getMust,
} = require("./src/config");
const {
    prepare,
} = require("./src/clients/database");

runLoader();

const runners = [];
if (getMust("MATRIX_USERNAME")) {
    runners.push(require("./src/matrix"));
}
if (getMust("DISCORD_BOT_TOKEN")) {
    runners.push(require("./src/discord"));
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
