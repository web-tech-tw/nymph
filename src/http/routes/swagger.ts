import { envEnabled } from "../../config/index.ts";
import { useApp, express } from "../app.ts";
import { useApiDoc } from "./api-doc.ts";
import swaggerUi from "swagger-ui-express";

const router = express.Router();

export default async function mountSwaggerRoutes(): Promise<void> {
    if (!envEnabled("ENABLED_SWAGGER")) return;

    const apiDoc = await useApiDoc();
    router.use("/", swaggerUi.serve, swaggerUi.setup(apiDoc));
    useApp().use("/swagger", router);
}
