"use strict";

require("dotenv").config();

const {
    createClient,
} = require("matrix-js-sdk");

const {
    MATRIX_HOMESERVER: homeserverUrl,
    MATRIX_USERNAME: username,
    MATRIX_PASSWORD: password,
} = process.env;

console.info(
    "Get the AccessToken from Matrix",
    `(homeserver: ${homeserverUrl || "undefined"})`,
    "\n",
);

const client = createClient({baseUrl: homeserverUrl});
client.login("m.login.password", {
    identifier: {
        type: "m.id.user",
        user: username,
    },
    password,
}).then((response) => {
    console.info("UserId:", response.user_id);
    console.info("AccessToken:", response.access_token);
}).catch((e) => {
    console.error("Unauthorized", e);
});
