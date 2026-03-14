import { describe, it, expect, vi } from "vitest";
import { nodeAdapter } from "../adapters/node.js";
import { makeMockReq, makeMockRes } from "./helpers.js";
function makeAdapter(handler = null, path = "/events") {
    return nodeAdapter({ path, handler });
}
describe("nodeAdapter — path routing", () => {
    it("calls next() when path does not match", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ url: "/other" });
        const res = makeMockRes();
        const next = vi.fn();
        middleware(req, res, next);
        await new Promise((r) => setTimeout(r, 10));
        expect(next).toHaveBeenCalledOnce();
    });
    it("does NOT call next() when path matches", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ url: "/events", body: {} });
        const res = makeMockRes();
        const next = vi.fn();
        middleware(req, res, next);
        await res.done;
        expect(next).not.toHaveBeenCalled();
    });
    it("matches using req.path (Express style) over req.url", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ url: "/other", body: {} });
        req.path = "/events";
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });
    it("strips query string when matching path", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ url: "/events?foo=bar", body: {} });
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });
});
describe("nodeAdapter — always 200", () => {
    it("returns 200 for a valid POST", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ body: { x: 1 } });
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });
    it("returns 200 for OPTIONS (preflight)", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ method: "OPTIONS" });
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(result.statusCode).toBe(200);
    });
    it("returns 200 for GET (non-POST method)", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ method: "GET" });
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(result.statusCode).toBe(200);
    });
    it("returns 200 even when handler throws", async () => {
        const middleware = makeAdapter(async () => {
            throw new Error("boom");
        });
        const req = makeMockReq({ body: { x: 1 } });
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });
    it("returns 200 even when body is malformed JSON (streamed)", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ body: undefined });
        const res = makeMockRes();
        middleware(req, res);
        process.nextTick(() => {
            req.emit("data", Buffer.from("{bad json"));
            req.emit("end");
        });
        const result = await res.done;
        expect(result.statusCode).toBe(200);
    });
});
describe("nodeAdapter — handler", () => {
    it("calls handler with the parsed payload", async () => {
        const handler = vi.fn();
        const middleware = makeAdapter(handler);
        const payload = { event: "click", target: "button" };
        const req = makeMockReq({ body: payload });
        const res = makeMockRes();
        middleware(req, res);
        await res.done;
        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toEqual(payload);
    });
    it("passes the raw request as the second handler argument", async () => {
        const handler = vi.fn();
        const middleware = makeAdapter(handler);
        const req = makeMockReq({ body: {} });
        const res = makeMockRes();
        middleware(req, res);
        await res.done;
        expect(handler.mock.calls[0][1]).toBe(req);
    });
    it("does not call handler when method is not POST", async () => {
        const handler = vi.fn();
        const middleware = makeAdapter(handler);
        const req = makeMockReq({ method: "GET" });
        const res = makeMockRes();
        middleware(req, res);
        await res.done;
        expect(handler).not.toHaveBeenCalled();
    });
    it("works without a handler (handler is null)", async () => {
        const middleware = makeAdapter(null);
        const req = makeMockReq({ body: { x: 1 } });
        const res = makeMockRes();
        middleware(req, res);
        const result = await res.done;
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });
    it("awaits an async handler before responding", async () => {
        const order = [];
        const handler = async () => {
            await new Promise((r) => setTimeout(r, 10));
            order.push("handler");
        };
        const middleware = makeAdapter(handler);
        const req = makeMockReq({ body: {} });
        const res = makeMockRes();
        middleware(req, res);
        await res.done;
        order.push("done");
        expect(order).toEqual(["handler", "done"]);
    });
});
describe("nodeAdapter — raw Node ServerResponse", () => {
    it("writes correct status and JSON via writeHead/end", async () => {
        const middleware = makeAdapter();
        const req = makeMockReq({ body: {} });
        const res = makeMockRes();
        delete res.status;
        delete res.json;
        middleware(req, res);
        const result = await res.done;
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ ok: true });
    });
});
