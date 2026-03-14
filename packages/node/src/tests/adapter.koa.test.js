import { describe, it, expect, vi } from "vitest";
import { koaAdapter } from "../adapters/koa.js";
import { makeMockKoaCtx } from "./helpers.js";
function makeMiddleware(handler = null, path = "/events") {
    return koaAdapter({ path, handler });
}
const noop = async () => { };
describe("koaAdapter — path routing", () => {
    it("calls next() when path does not match", async () => {
        const middleware = makeMiddleware();
        const ctx = makeMockKoaCtx({ path: "/other" });
        const next = vi.fn().mockResolvedValue(undefined);
        await middleware(ctx, next);
        expect(next).toHaveBeenCalledOnce();
    });
    it("does NOT call next() when path matches", async () => {
        const middleware = makeMiddleware();
        const ctx = makeMockKoaCtx({ path: "/events", requestBody: {} });
        const next = vi.fn();
        await middleware(ctx, next);
        expect(next).not.toHaveBeenCalled();
    });
    it("works with a custom path", async () => {
        const middleware = makeMiddleware(null, "/collect");
        const ctx = makeMockKoaCtx({ path: "/collect", requestBody: {} });
        await middleware(ctx, noop);
        expect(ctx.status).toBe(200);
    });
});
describe("koaAdapter — always 200", () => {
    it("sets ctx.status = 200 and ctx.body = { ok: true }", async () => {
        const middleware = makeMiddleware();
        const ctx = makeMockKoaCtx({ requestBody: { event: "view" } });
        await middleware(ctx, noop);
        expect(ctx.status).toBe(200);
        expect(ctx.body).toEqual({ ok: true });
    });
    it("returns 200 even when handler throws", async () => {
        const middleware = makeMiddleware(async () => {
            throw new Error("fail");
        });
        const ctx = makeMockKoaCtx({ requestBody: { x: 1 } });
        await middleware(ctx, noop);
        expect(ctx.status).toBe(200);
        expect(ctx.body).toEqual({ ok: true });
    });
    it("returns 200 for non-POST methods", async () => {
        const middleware = makeMiddleware();
        const ctx = makeMockKoaCtx({ method: "GET" });
        await middleware(ctx, noop);
        expect(ctx.status).toBe(200);
    });
    it("returns 200 when raw stream body is invalid JSON", async () => {
        const middleware = makeMiddleware();
        const ctx = makeMockKoaCtx({ path: "/events" });
        const promise = middleware(ctx, noop);
        process.nextTick(() => {
            ctx.req.emit("data", Buffer.from("{bad"));
            ctx.req.emit("end");
        });
        await promise;
        expect(ctx.status).toBe(200);
    });
});
describe("koaAdapter — body parsing", () => {
    it("uses ctx.request.body when set by koa-bodyparser", async () => {
        const handler = vi.fn();
        const middleware = makeMiddleware(handler);
        const payload = { source: "koa-bodyparser" };
        const ctx = makeMockKoaCtx({ requestBody: payload });
        await middleware(ctx, noop);
        expect(handler.mock.calls[0][0]).toEqual(payload);
    });
    it("falls back to raw stream when ctx.request.body is undefined", async () => {
        const handler = vi.fn();
        const middleware = makeMiddleware(handler);
        const ctx = makeMockKoaCtx({ path: "/events" });
        const payload = { source: "stream" };
        const promise = middleware(ctx, noop);
        process.nextTick(() => {
            ctx.req.simulateBody(payload);
        });
        await promise;
        expect(handler.mock.calls[0][0]).toEqual(payload);
    });
});
describe("koaAdapter — handler", () => {
    it("calls handler with the parsed payload", async () => {
        const handler = vi.fn();
        const middleware = makeMiddleware(handler);
        const payload = { page: "/about", duration: 3200 };
        const ctx = makeMockKoaCtx({ requestBody: payload });
        await middleware(ctx, noop);
        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toEqual(payload);
    });
    it("passes the Koa context as the second handler argument", async () => {
        const handler = vi.fn();
        const middleware = makeMiddleware(handler);
        const ctx = makeMockKoaCtx({ requestBody: {} });
        await middleware(ctx, noop);
        expect(handler.mock.calls[0][1]).toBe(ctx);
    });
    it("does not call handler when method is not POST", async () => {
        const handler = vi.fn();
        const middleware = makeMiddleware(handler);
        const ctx = makeMockKoaCtx({ method: "GET" });
        await middleware(ctx, noop);
        expect(handler).not.toHaveBeenCalled();
    });
    it("works without a handler (null)", async () => {
        const middleware = makeMiddleware(null);
        const ctx = makeMockKoaCtx({ requestBody: {} });
        await middleware(ctx, noop);
        expect(ctx.body).toEqual({ ok: true });
    });
});
