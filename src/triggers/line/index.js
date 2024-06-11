"use strict";

const triggers = {
    message: require("./message"),
};

exports.useDispatcher = () => async (event) => {
    if (!Object.hasOwn(triggers, event.type)) {
        return;
    }
    await triggers[event.type](event);
};
