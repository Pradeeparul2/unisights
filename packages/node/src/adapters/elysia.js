export function elysiaAdapter(config) {
    const { path, handler } = config;
    return function applyToElysia(app) {
        app.post(path, async (ctx) => {
            try {
                const payload = (ctx.body ?? {});
                if (handler) {
                    await handler(payload, ctx);
                }
            }
            catch {
            }
            return { ok: true };
        });
        return app;
    };
}
