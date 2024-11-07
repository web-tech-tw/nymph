"use strict";

// Import config
const {
    runLoader,
    getEnvironmentOverview,
} = require("./src/config");

// Load config
runLoader();

// Import constants
const constant = require("./src/init/const");

// Import useApp
const {useApp} = require("./src/init/express");

// Initialize application
const app = useApp();

// Initialize prepare handlers
const {
    prepare: prepareDatabase,
} = require("./src/init/database");
const {
    prepare: prepareListener,
} = require("./src/init/listener");

const prepareHandlers = [
    prepareDatabase,
    prepareListener,
];

// Render index page
app.get("/", (_, res) => {
    res.render("index");
});

// The handler for robots.txt (deny all friendly robots)
app.get("/robots.txt", (_, res) => {
    res.type("txt").send("User-agent: *\nDisallow: /");
});

// Load router dispatcher
const routerDispatcher = require("./src/routes");
routerDispatcher.load();

// Show banner message
(() => {
    const {APP_NAME: appName} = constant;
    const {node, runtime} = getEnvironmentOverview();
    const statusMessage = `(environment: ${node}, ${runtime})`;
    console.info(appName, statusMessage, "\n====");
})();

// Mount application and execute it
require("./src/execute")(app, prepareHandlers,
    ({protocol, hostname, port}) => {
        console.info(`Protocol "${protocol}" is listening at`);
        console.info(`${protocol}://${hostname}:${port}`);
    },
);
