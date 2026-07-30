import express from "express";
import { fileURLToPath } from "node:url";
import { StatusCodes } from "http-status-codes";

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const staticDir = fileURLToPath(new URL("../public", import.meta.url));
app.use("/static", express.static(staticDir));

const viewsDir = fileURLToPath(new URL("../views", import.meta.url));
app.set("view engine", "ejs");
app.set("views", viewsDir);

export function indexHandler(_req: express.Request, res: express.Response): void {
    res.render("index", { baseUrl: "http://localhost:3000" });
}

export function heartHandler(_req: express.Request, res: express.Response): void {
    res.status(StatusCodes.OK).json({ status: "alive", timestamp: new Date().toISOString() });
}
