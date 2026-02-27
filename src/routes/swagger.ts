import { getEnabled } from "../config.ts";
import { useApiDoc } from "../init/api_doc.ts";
import { useApp, express } from "../init/express.ts";
import swaggerUi from "swagger-ui-express";

const { Router: newRouter } = express;
const router = newRouter();

export default async () => {
    if (!getEnabled("ENABLED_SWAGGER")) {
        return;
    }

    const apiDoc = await useApiDoc();
    router.use("/", swaggerUi.serve, swaggerUi.setup(apiDoc));

    const app = useApp();
    app.use("/swagger", router);
};
