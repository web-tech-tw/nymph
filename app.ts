// Import config
import {
    runLoader,
    getEnvironmentOverview,
} from "./src/config.ts";

// Load config
runLoader();

// Import constants
import * as constant from "./src/init/const.ts";

// Import useApp
import {useApp} from "./src/init/express.ts";

// Initialize application
const app = useApp();

// Initialize prepare handlers
import {
    prepare as prepareDatabase,
} from "./src/init/database.ts";
import {
    prepare as prepareListener,
} from "./src/init/listener.ts";

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
import * as routerDispatcher from "./src/routes/index.ts";
routerDispatcher.load();

// Show banner message
(() => {
    const {APP_NAME: appName} = constant;
    const {node, runtime} = getEnvironmentOverview();
    const statusMessage = `(environment: ${node}, ${runtime})`;
    console.info(appName, statusMessage, "\n====");
})();

// Mount application and execute it
import execute from "./src/execute.ts";
execute(app, prepareHandlers,
    ({protocol, hostname, port}) => {
        console.info(`Protocol "${protocol}" is listening at`);
        console.info(`${protocol}://${hostname}:${port}`);
    },
);
