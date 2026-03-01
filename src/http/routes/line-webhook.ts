import { useApp, express } from "../app.ts";
import { useLineMiddleware } from "../../platforms/line/client.ts";
import { createDispatcher } from "../../platforms/line/handlers.ts";
import type { Request, Response, NextFunction } from "express";

interface LineWebhookBody {
    events: Array<{ type: string }>;
}

const router = express.Router();
const middleware = useLineMiddleware();
const dispatcher = createDispatcher();

router.post(
    "/webhook",
    (req: Request, res: Response, next: NextFunction) => middleware(req, res, next),
    (req: Request, res: Response) => {
        const { events } = req.body as LineWebhookBody;
        Promise.all(events.map(dispatcher))
            .then((result) => res.json(result))
            .catch((err: unknown) => { console.error(err); res.status(500).end(); });
    },
);

export default function mountLineRoutes(): void {
    useApp().use("/line", router);
}
