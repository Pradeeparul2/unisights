import { describe, it, expect, vi } from "vitest";
import { fetchAdapter } from "../adapters/fetch.js";
import { makeFetchRequest } from "./helpers.js";
function makeHandler(handler = null, path = "/events") {
    return fetchAdapter({ path, handler });
}
describe("fetchAdapter — path routing", () => {
    it("returns null when path does not match", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ url: "http://localhost/other" });
        const result = await handle(req);
        expect(result).toBeNull();
    });
    it("returns a Response when path matches", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ url: "http://localhost/events" });
        const result = await handle(req);
        expect(result).toBeInstanceOf(Response);
    });
    it("matches exactly — /events does not match /events/sub", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ url: "http://localhost/events/sub" });
        const result = await handle(req);
        expect(result).toBeNull();
    });
    it("ignores query string in URL when matching path", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({
            url: "http://localhost/events?session=abc",
        });
        const result = await handle(req);
        expect(result).toBeInstanceOf(Response);
    });
    it("works with a custom path", async () => {
        const handle = makeHandler(null, "/collect");
        const req = makeFetchRequest({ url: "http://localhost/collect", body: {} });
        const result = await handle(req);
        expect(result).not.toBeNull();
    });
});
describe("fetchAdapter — always 200", () => {
    it("returns 200 for a valid POST", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ body: { event: "view" } });
        const res = await handle(req);
        expect(res?.status).toBe(200);
        expect(await res?.json()).toEqual({ ok: true });
    });
    it("returns 200 for a GET request", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ method: "GET" });
        const res = await handle(req);
        expect(res?.status).toBe(200);
    });
    it("returns 200 for an OPTIONS request", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ method: "OPTIONS" });
        const res = await handle(req);
        expect(res?.status).toBe(200);
    });
    it("returns 200 even when handler throws", async () => {
        const handle = makeHandler(async () => {
            throw new Error("crash");
        });
        const req = makeFetchRequest({ body: { x: 1 } });
        const res = await handle(req);
        expect(res?.status).toBe(200);
        expect(await res?.json()).toEqual({ ok: true });
    });
    it("returns 200 when body is invalid JSON", async () => {
        const handle = makeHandler();
        const req = new Request("http://localhost/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{bad json",
        });
        const res = await handle(req);
        expect(res?.status).toBe(200);
    });
    it("sets Content-Type: application/json on response", async () => {
        const handle = makeHandler();
        const req = makeFetchRequest({ body: {} });
        const res = await handle(req);
        expect(res?.headers.get("Content-Type")).toBe("application/json");
    });
});
describe("fetchAdapter — handler", () => {
    it("calls handler with the parsed payload", async () => {
        const handler = vi.fn();
        const handle = makeHandler(handler);
        const payload = { userId: "u1", event: "signup" };
        const req = makeFetchRequest({ body: payload });
        await handle(req);
        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0]).toEqual(payload);
    });
    it("passes the raw Request as the second handler argument", async () => {
        const handler = vi.fn();
        const handle = makeHandler(handler);
        const req = makeFetchRequest({ body: {} });
        await handle(req);
        expect(handler.mock.calls[0][1]).toBe(req);
    });
    it("does not call handler when method is not POST", async () => {
        const handler = vi.fn();
        const handle = makeHandler(handler);
        const req = makeFetchRequest({ method: "GET" });
        await handle(req);
        expect(handler).not.toHaveBeenCalled();
    });
    it("works without a handler (null)", async () => {
        const handle = makeHandler(null);
        const req = makeFetchRequest({ body: { a: 1 } });
        const res = await handle(req);
        expect(await res?.json()).toEqual({ ok: true });
    });
    it("awaits an async handler", async () => {
        const order = [];
        const handle = makeHandler(async () => {
            await new Promise((r) => setTimeout(r, 10));
            order.push("handler");
        });
        const req = makeFetchRequest({ body: {} });
        await handle(req);
        order.push("done");
        expect(order).toEqual(["handler", "done"]);
    });
    it("handler receives an empty object when body cannot be parsed", async () => {
        const handler = vi.fn();
        const handle = makeHandler(handler);
        const req = new Request("http://localhost/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{bad",
        });
        await handle(req);
        expect(handler).toHaveBeenCalledWith({}, expect.anything());
    });
});
