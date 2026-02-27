import { getEnabled, getMust } from "../config.ts";
import cors from "cors";

const corsOrigin = getMust("CORS_ORIGIN");
const swaggerCorsOrigin = getMust("SWAGGER_CORS_ORIGIN");

export default cors({
    origin: getEnabled("ENABLED_SWAGGER")
        ? [corsOrigin, swaggerCorsOrigin]
        : corsOrigin,
});
