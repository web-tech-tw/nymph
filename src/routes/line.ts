
import {useApp, express} from "../init/express.ts";

import {
    useMiddleware,
} from "../clients/line.ts";
import {
    useDispatcher,
} from "../listeners/line/index.ts";
import type { Request, Response, NextFunction } from "express";

const {Router: newRouter} = express;
const router = newRouter();

const middleware = useMiddleware();
const dispatcher = useDispatcher();

// Middleware wrapper to satisfy TS if needed, though useMiddleware usually returns a valid middleware.
// But useMiddleware returns `any` in our TS definition.
const middlewareHandler = (req: Request, res: Response, next: NextFunction) => middleware(req, res, next);

router.post("/webhook", middlewareHandler, (req: Request, res: Response) => {
    // @ts-ignore
    Promise.all(req.body.events.map(dispatcher))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

export default () => {
    // Use application
    const app = useApp();

    // Mount the router
    app.use("/line", router);
};
