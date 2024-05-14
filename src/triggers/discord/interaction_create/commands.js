"use strict";

const userId = {
    description: "取得使用者識別碼",
    action: async (interaction) => {
        interaction.reply(
            `使用者代號：\`${interaction.user.tag}\`\n` +
            `使用者編碼：\`${interaction.user.id}\``,
        );
    },
};

module.exports = {
    userId,
};
