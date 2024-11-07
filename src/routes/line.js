"use strict";

const {useApp, express} = require("../init/express");

const {
    useMiddleware,
} = require("../clients/line");
const {
    useDispatcher,
} = require("../listeners/line");

const {Router: newRouter} = express;
const router = newRouter();

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
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/line", router);
};
