import { parseBody } from "../parseBody.js";
export function koaAdapter(config) {
    const { path, handler } = config;
    return async function uniSitesKoa(ctx, next) {
        if (ctx.path !== path) {
            await next();
            return;
        }
        if (ctx.method === "POST") {
            try {
                const payload = (ctx.request.body !== undefined
                    ? ctx.request.body
                    : await parseBody(ctx.req));
                if (handler) {
                    await handler(payload, ctx);
                }
            }
            catch {
            }
        }
        ctx.status = 200;
        ctx.body = { ok: true };
    };
}
