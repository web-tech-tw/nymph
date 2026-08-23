import { Elysia } from "elysia";
import { html, Html } from "@elysiajs/html";
import { authPlugin } from "../plugins/auth";
import { TokensPage } from "../views/tokens";
import {
    createMcpToken,
    listMcpTokens,
    deleteMcpToken,
    updateMcpTokenLabel,
    rotateMcpToken,
} from "../databases/models/mcp-token";
import { cacheUserProfile } from "../databases/models/user-profile";

const saraInteHost = Bun.env.SARA_INTE_HOST || "https://web-tech.tw/sara";
const baseUrl = Bun.env.BASE_URL || "";

export const mcpRoutes = new Elysia({ prefix: "/mcp" })
    .use(html())
    .use(authPlugin)
    .get("/tokens", async ({ auth, headers, query }) => {
        const accept = headers["accept"] || "";
        if (query?.format === "json" || accept.includes("application/json")) {
            if (!auth) {
                return { error: "Unauthorized" };
            }
            if (auth.metadata?.profile) {
                await cacheUserProfile(auth.id, auth.metadata.profile);
            }
            const tokens = await listMcpTokens(auth.id);
            return {
                tokens: tokens.map((t) => ({
                    id: t._id?.toString() || "",
                    token: t.token,
                    label: t.label,
                    createdAt: t.createdAt,
                    updatedAt: t.updatedAt,
                    lastUsedAt: t.lastUsedAt,
                })),
            };
        }

        return (
            <TokensPage
                saraInteHost={saraInteHost}
                baseUrl={baseUrl}
            />
        );
    })
    .get("/me", async ({ auth, set }) => {
        if (!auth) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const profile = auth.metadata?.profile;
        if (profile) {
            await cacheUserProfile(auth.id, profile);
        }

        return {
            id: auth.id,
            profile,
        };
    })
    // POST /mcp/tokens - Issue new MCP token
    .post("/tokens", async ({ auth, body, set }) => {
        if (!auth) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const payload = (body || {}) as { label?: string };
        if (auth.metadata?.profile) {
            await cacheUserProfile(auth.id, auth.metadata.profile);
        }
        const doc = await createMcpToken(auth.id, payload.label);

        return {
            success: true,
            token: {
                id: doc._id?.toString() || "",
                token: doc.token,
                label: doc.label,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            },
        };
    })
    // DELETE /mcp/token and /mcp/tokens - Delete an MCP token
    .delete("/token", async ({ auth, body, query, set }) => {
        if (!auth) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const id = (body as { id?: string })?.id || query?.id;
        const token = (body as { token?: string })?.token || query?.token;

        if (!id && !token) {
            set.status = 400;
            return { error: "Missing token id or token secret" };
        }

        const deleted = await deleteMcpToken(auth.id, { id, token });
        if (!deleted) {
            set.status = 404;
            return { error: "Token not found" };
        }

        return {
            success: true,
            message: "Token deleted successfully",
        };
    })
    .delete("/tokens", async ({ auth, body, query, set }) => {
        if (!auth) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const id = (body as { id?: string })?.id || query?.id;
        const token = (body as { token?: string })?.token || query?.token;

        if (!id && !token) {
            set.status = 400;
            return { error: "Missing token id or token secret" };
        }

        const deleted = await deleteMcpToken(auth.id, { id, token });
        if (!deleted) {
            set.status = 404;
            return { error: "Token not found" };
        }

        return {
            success: true,
            message: "Token deleted successfully",
        };
    })
    // PATCH /mcp/tokens - Rename token label
    .patch("/tokens", async ({ auth, body, set }) => {
        if (!auth) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const payload = (body || {}) as { id?: string; token?: string; label?: string };
        const { id, token, label } = payload;

        if (!label || typeof label !== "string" || !label.trim()) {
            set.status = 400;
            return { error: "Missing or invalid label" };
        }

        if (!id && !token) {
            set.status = 400;
            return { error: "Missing token id or token secret" };
        }

        const doc = await updateMcpTokenLabel(auth.id, { id, token }, label);
        if (!doc) {
            set.status = 404;
            return { error: "Token not found" };
        }

        return {
            success: true,
            token: {
                id: doc._id?.toString() || "",
                token: doc.token,
                label: doc.label,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            },
        };
    })
    // PUT /mcp/tokens - Rotate token secret
    .put("/tokens", async ({ auth, body, set }) => {
        if (!auth) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        const payload = (body || {}) as { id?: string; token?: string };
        const { id, token } = payload;

        if (!id && !token) {
            set.status = 400;
            return { error: "Missing token id or token secret" };
        }

        const doc = await rotateMcpToken(auth.id, { id, token });
        if (!doc) {
            set.status = 404;
            return { error: "Token not found" };
        }

        return {
            success: true,
            token: {
                id: doc._id?.toString() || "",
                token: doc.token,
                label: doc.label,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
            },
        };
    });
