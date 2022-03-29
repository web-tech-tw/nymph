'use strict'

module.exports = function (state, _) {
    state.simpleCommandExecutor({
        "debug": (_, message) => {
            message.channel.send(JSON.stringify(message));
        },
    });
}
