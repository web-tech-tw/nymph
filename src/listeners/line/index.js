"use strict";

const {
    useClient,
} = require("../../clients/line");

const triggers = {
    message: require("./message"),
};

exports.useDispatcher = () => async (event) => {
    if (!Object.hasOwn(triggers, event.type)) {
        return;
    }
    await triggers[event.type](event);
};

exports.prepare = async () => {
    const client = useClient();

    const showStartupMessage = async () => {
        const {displayName, basicId} = await client.getBotInfo();
        console.info(`LINE 身份：${displayName} (${basicId})`);
    };

    showStartupMessage();
};

exports.listen = () => {};
