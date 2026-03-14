/**
 * tests/adapter.hono.test.ts
 * Unit tests for the Hono adapter.
 */

import { describe, it, expect, vi } from "vitest";
import { honoAdapter } from "../adapters/hono.js";
import { makeMockHonoCtx } from "./helpers.js";

function makeHandler(handler = null as any, path = "/events") {
  return honoAdapter({ path, handler });
}

const noop = async () => {};

// ── Path routing ──────────────────────────────────────────────────────────────

describe("honoAdapter — path routing", () => {
  it("calls next() when path does not match", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ url: "http://localhost/other" });
    const next = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx as any, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("does NOT call next() when path matches", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ url: "http://localhost/events" });
    const next = vi.fn();
    await middleware(ctx as any, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a Response when path matches", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ url: "http://localhost/events" });
    const result = await middleware(ctx as any, noop);
    expect(result).toBeInstanceOf(Response);
  });

  it("matches exactly — /events does not match /events/sub", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ url: "http://localhost/events/sub" });
    const next = vi.fn().mockResolvedValue(undefined);
    await middleware(ctx as any, next);
    expect(next).toHaveBeenCalled();
  });

  it("works with a custom path", async () => {
    const middleware = makeHandler(null, "/collect");
    const ctx = makeMockHonoCtx({ url: "http://localhost/collect" });
    const result = await middleware(ctx as any, noop);
    expect(result).toBeInstanceOf(Response);
  });
});

// ── Always 200 ────────────────────────────────────────────────────────────────

describe("honoAdapter — always 200", () => {
  it("returns 200 for a POST request", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ method: "POST" });
    const res = (await middleware(ctx as any, noop)) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 200 for a non-POST method", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ method: "GET" });
    const res = (await middleware(ctx as any, noop)) as Response;
    expect(res.status).toBe(200);
  });

  it("returns 200 even when handler throws", async () => {
    const middleware = makeHandler(async () => {
      throw new Error("crash");
    });
    const ctx = makeMockHonoCtx({ body: { a: 1 } });
    const res = (await middleware(ctx as any, noop)) as Response;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 200 when json() on the context request rejects", async () => {
    const middleware = makeHandler();
    const ctx = makeMockHonoCtx({ url: "http://localhost/events" });
    ctx.req.json = async () => {
      throw new Error("bad json");
    };
    const res = (await middleware(ctx as any, noop)) as Response;
    expect(res.status).toBe(200);
  });
});

// ── Handler invocation ────────────────────────────────────────────────────────

describe("honoAdapter — handler", () => {
  it("calls handler with the parsed payload", async () => {
    const handler = vi.fn();
    const middleware = makeHandler(handler);
    const payload = { action: "add_to_cart", item: "shoe" };
    const ctx = makeMockHonoCtx({ body: payload });
    await middleware(ctx as any, noop);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual(payload);
  });

  it("passes the Hono context as the second handler argument", async () => {
    const handler = vi.fn();
    const middleware = makeHandler(handler);
    const ctx = makeMockHonoCtx({ body: {} });
    await middleware(ctx as any, noop);
    expect(handler.mock.calls[0][1]).toBe(ctx);
  });

  it("does not call handler when method is not POST", async () => {
    const handler = vi.fn();
    const middleware = makeHandler(handler);
    const ctx = makeMockHonoCtx({ method: "GET" });
    await middleware(ctx as any, noop);
    expect(handler).not.toHaveBeenCalled();
  });

  it("works without a handler (null)", async () => {
    const middleware = makeHandler(null);
    const ctx = makeMockHonoCtx({ body: {} });
    const res = (await middleware(ctx as any, noop)) as Response;
    expect(await res.json()).toEqual({ ok: true });
  });

  it("awaits an async handler before returning", async () => {
    const order: string[] = [];
    const middleware = makeHandler(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("handler");
    });
    const ctx = makeMockHonoCtx({ body: {} });
    await middleware(ctx as any, noop);
    order.push("done");
    expect(order).toEqual(["handler", "done"]);
  });
});
