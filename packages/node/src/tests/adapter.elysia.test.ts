/**
 * tests/adapter.elysia.test.ts
 * Unit tests for the Elysia (Bun) adapter.
 */

import { describe, it, expect, vi } from "vitest";
import { elysiaAdapter } from "../adapters/elysia.js";
import { makeMockElysiaApp, makeMockElysiaCtx } from "./helpers.js";

function makePlugin(handler = null as any, path = "/events") {
  return elysiaAdapter({ path, handler });
}

// ── App registration ──────────────────────────────────────────────────────────

describe("elysiaAdapter — registration", () => {
  it("registers a POST route on the Elysia app", () => {
    const plugin = makePlugin();
    const app = makeMockElysiaApp();
    plugin(app as any);
    expect(app.routes).toHaveLength(1);
    expect(app.routes[0].path).toBe("/events");
  });

  it("registers at the custom path", () => {
    const plugin = makePlugin(null, "/collect");
    const app = makeMockElysiaApp();
    plugin(app as any);
    expect(app.routes[0].path).toBe("/collect");
  });

  it("returns the app instance for chaining", () => {
    const plugin = makePlugin();
    const app = makeMockElysiaApp();
    const returned = plugin(app as any);
    expect(returned).toBe(app);
  });
});

// ── Always 200 ────────────────────────────────────────────────────────────────

describe("elysiaAdapter — always 200", () => {
  it("returns { ok: true } for a valid request", async () => {
    const plugin = makePlugin();
    const app = makeMockElysiaApp();
    plugin(app as any);
    const result = await app.callPost({ event: "load" });
    expect(result).toEqual({ ok: true });
  });

  it("returns { ok: true } even when handler throws", async () => {
    const plugin = makePlugin(async () => {
      throw new Error("crash");
    });
    const app = makeMockElysiaApp();
    plugin(app as any);
    const result = await app.callPost({ x: 1 });
    expect(result).toEqual({ ok: true });
  });

  it("returns { ok: true } when body is undefined", async () => {
    const plugin = makePlugin();
    const app = makeMockElysiaApp();
    plugin(app as any);
    const result = await app.callPost(undefined);
    expect(result).toEqual({ ok: true });
  });
});

// ── Handler invocation ────────────────────────────────────────────────────────

describe("elysiaAdapter — handler", () => {
  it("calls handler with ctx.body as the payload", async () => {
    const handler = vi.fn();
    const plugin = makePlugin(handler);
    const app = makeMockElysiaApp();
    plugin(app as any);
    const payload = { feature: "dark-mode", enabled: true };
    await app.callPost(payload);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual(payload);
  });

  it("passes the Elysia context as the second handler argument", async () => {
    const handler = vi.fn();
    const plugin = makePlugin(handler);
    const app = makeMockElysiaApp();
    plugin(app as any);
    await app.callPost({ a: 1 });
    // ctx is the full Elysia context object
    const ctx = handler.mock.calls[0][1];
    expect(ctx).toHaveProperty("body");
    expect(ctx).toHaveProperty("set");
  });

  it("uses empty object when ctx.body is undefined", async () => {
    const handler = vi.fn();
    const plugin = makePlugin(handler);
    const app = makeMockElysiaApp();
    plugin(app as any);
    await app.callPost(undefined);
    expect(handler.mock.calls[0][0]).toEqual({});
  });

  it("works without a handler (null)", async () => {
    const plugin = makePlugin(null);
    const app = makeMockElysiaApp();
    plugin(app as any);
    const result = await app.callPost({});
    expect(result).toEqual({ ok: true });
  });

  it("awaits async handlers", async () => {
    const order: string[] = [];
    const plugin = makePlugin(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("handler");
    });
    const app = makeMockElysiaApp();
    plugin(app as any);
    await app.callPost({});
    order.push("done");
    expect(order).toEqual(["handler", "done"]);
  });
});
