import { describe, it, expect, vi } from "vitest";
import { fastifyAdapter } from "../adapters/fastify.js";
function makeMockFastify() {
    const routes = {};
    let ctParser = null;
    const fastify = {
        addContentTypeParser(_ct, _opts, fn) {
            ctParser = fn;
        },
        post(path, handler) {
            routes[path] = handler;
        },
        options(_path, _handler) { },
        async callRoute(path, body) {
            const req = { body };
            const reply = {
                _status: 200,
                _body: null,
                code(n) {
                    this._status = n;
                    return this;
                },
                send(b) {
                    this._body = b;
                },
            };
            await routes[path](req, reply);
            return { status: reply._status, body: reply._body };
        },
        parseBody(raw) {
            if (!ctParser)
                throw new Error("No content type parser registered");
            return new Promise((resolve, reject) => {
                ctParser(null, raw, (err, val) => {
                    if (err)
                        reject(err);
                    else
                        resolve(val);
                });
            });
        },
    };
    return fastify;
}
function makePlugin(handler = null, path = "/events") {
    return fastifyAdapter({ path, handler });
}
describe("fastifyAdapter — plugin registration", () => {
    it("registers a POST route at the configured path", async () => {
        const plugin = makePlugin();
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const result = await fastify.callRoute("/events", {});
        expect(result.status).toBe(200);
    });
    it("has skip-override symbol set (Fastify plugin metadata)", () => {
        const plugin = makePlugin();
        expect(plugin[Symbol.for("skip-override")]).toBe(true);
    });
    it('has fastify.display-name set to "unisights"', () => {
        const plugin = makePlugin();
        expect(plugin[Symbol.for("fastify.display-name")]).toBe("unisights");
    });
    it("registers a content type parser for application/json", async () => {
        const plugin = makePlugin();
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const result = await fastify.parseBody('{"x":1}');
        expect(result).toEqual({ x: 1 });
    });
    it("content type parser returns empty object for invalid JSON (no throw)", async () => {
        const plugin = makePlugin();
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const result = await fastify.parseBody("{bad json");
        expect(result).toEqual({});
    });
});
describe("fastifyAdapter — always 200", () => {
    it("returns 200 { ok: true } for a valid request", async () => {
        const plugin = makePlugin();
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const result = await fastify.callRoute("/events", { event: "click" });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ ok: true });
    });
    it("returns 200 even when handler throws", async () => {
        const plugin = makePlugin(async () => {
            throw new Error("boom");
        });
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const result = await fastify.callRoute("/events", { x: 1 });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ ok: true });
    });
});
describe("fastifyAdapter — handler", () => {
    it("calls handler with the parsed body", async () => {
        const handler = vi.fn();
        const plugin = makePlugin(handler);
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const payload = { userId: "u99", page: "/dashboard" };
        await fastify.callRoute("/events", payload);
        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toEqual(payload);
    });
    it("works without a handler (null)", async () => {
        const plugin = makePlugin(null);
        const fastify = makeMockFastify();
        await plugin(fastify, {});
        const result = await fastify.callRoute("/events", {});
        expect(result.body).toEqual({ ok: true });
    });
});
