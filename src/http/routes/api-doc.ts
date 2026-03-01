import { envRequired } from "../../config/index.ts";
import {
    APP_NAME,
    APP_DESCRIPTION,
    APP_VERSION,
    APP_AUTHOR_NAME,
    APP_AUTHOR_URL,
} from "../../constants.ts";
import { join } from "node:path";
import swaggerJSDoc from "swagger-jsdoc";

const routesDir = new URL(".", import.meta.url).pathname;

export async function useApiDoc() {
    const options = {
        definition: {
            openapi: "3.0.0",
            info: {
                title: APP_NAME,
                version: APP_VERSION,
                description: APP_DESCRIPTION,
                contact: { name: APP_AUTHOR_NAME, url: APP_AUTHOR_URL },
            },
            servers: [{
                description: envRequired("SWAGGER_SERVER_DESCRIPTION"),
                url: envRequired("SWAGGER_SERVER_URL"),
            }],
            components: {
                securitySchemes: {
                    ApiKeyAuth: { type: "apiKey", in: "header", name: "Authorization" },
                },
            },
        },
        apis: [
            join(routesDir, "line-webhook.ts"),
            join(routesDir, "swagger.ts"),
        ],
    };

    return swaggerJSDoc(options);
}
