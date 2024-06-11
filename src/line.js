"use strict";

const {
    Router: createRouter,
} = require("express");

const {
    useClient,
    useMiddleware,
} = require("./clients/line");
const {
    useDispatcher,
} = require("./triggers/line");

const router = createRouter();
const client = useClient();
const middleware = useMiddleware();
const dispatcher = useDispatcher();

router.post("/webhook", middleware, (req, res) => {
    Promise.all(req.body.events.map(dispatcher))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

module.exports = () => {
    const showStartupMessage = async () => {
        const {displayName, basicId} = await client.getBotInfo();
        console.info(`LINE 身份：${displayName} (${basicId})`);
    };

    showStartupMessage();
    return router;
};
