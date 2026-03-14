import { parseBody } from "../parseBody.js";
export function fastifyAdapter(config) {
    const { path, handler } = config;
    async function plugin(fastify) {
        fastify.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
            try {
                done(null, JSON.parse(body));
            }
            catch {
                done(null, {});
            }
        });
        fastify.post(path, async (request, reply) => {
            try {
                const payload = (request.body ??
                    (await parseBody(request.raw)));
                if (handler) {
                    await handler(payload, request);
                }
            }
            catch {
            }
            reply.code(200).send({ ok: true });
        });
        fastify.options(path, async (_request, reply) => {
            reply.code(200).send({ ok: true });
        });
    }
    plugin[Symbol.for("skip-override")] =
        true;
    plugin[Symbol.for("fastify.display-name")] = "unisights";
    return plugin;
}
