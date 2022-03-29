'use strict'

module.exports = function (state, message) {
    if (message.guild.id !== process.env.GUILD_ID) return;
    if (message.channel.id !== process.env.TERMINAL_CHANNEL_ID) return;
    state.simpleCommandExecutor({
        "hi": (_, message) => {
            message.channel.send("Hi")
        },
        "clear": async (state, message) => {
            if (!state.isSecurity(message)) return;
            const messages = await message.channel.messages.fetch();
            messages.forEach((item) => item.delete());
        },
        "show_roles": (state, message) => {
            state.database.query(
                'SELECT * FROM `roles` WHERE `allow_assign` = TRUE',
                function (err, results) {
                    if (err) {
                        message.channel.send(JSON.stringify(err));
                        return
                    }
                    message.channel.send(JSON.stringify(results));
                }
            );
        }
    });
}
