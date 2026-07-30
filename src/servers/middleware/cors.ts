import { envEnabled, envRequired } from "../../config/index.ts";
import cors from "cors";

const origin = envRequired("CORS_ORIGIN");
const swaggerOrigin = envRequired("SWAGGER_CORS_ORIGIN");

export default cors({
    origin: envEnabled("ENABLED_SWAGGER") ? [origin, swaggerOrigin] : origin,
});
