import { getMust } from "../config.ts";
import {
    APP_NAME,
    APP_DESCRIPTION,
    APP_VERSION,
    APP_AUTHOR_NAME,
    APP_AUTHOR_URL,
} from "./const.ts";
import { join as pathJoin } from "node:path";
import swaggerJSDoc from "swagger-jsdoc";

const initDir = new URL(".", import.meta.url).pathname;

const routerFilePathPrefix = pathJoin(initDir, "..", "routes");

export const useApiDoc = async () => {
    const { routerFiles } = await import("../routes/index.ts");

    const options = {
        definition: {
            openapi: "3.0.0",
            info: {
                title: APP_NAME,
                version: APP_VERSION,
                description: APP_DESCRIPTION,
                contact: {
                    name: APP_AUTHOR_NAME,
                    url: APP_AUTHOR_URL,
                },
            },
            servers: [{
                description: getMust("SWAGGER_SERVER_DESCRIPTION"),
                url: getMust("SWAGGER_SERVER_URL"),
            }],
            components: {
                securitySchemes: {
                    ApiKeyAuth: {
                        type: "apiKey",
                        in: "header",
                        name: "Authorization",
                    },
                },
            },
        },
        apis: routerFiles.map((f) => pathJoin(routerFilePathPrefix, f)),
    };

    return swaggerJSDoc(options);
};
