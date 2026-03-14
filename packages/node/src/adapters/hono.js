export function honoAdapter(config) {
    const { path, handler } = config;
    return async function uniSitesHono(c, next) {
        const url = new URL(c.req.url);
        if (url.pathname !== path)
            return next();
        if (c.req.method === "POST") {
            try {
                const payload = await c.req
                    .json()
                    .catch(() => ({}));
                if (handler) {
                    await handler(payload, c);
                }
            }
            catch {
            }
        }
        return c.json({ ok: true }, 200);
    };
}
