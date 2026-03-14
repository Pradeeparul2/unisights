/**
 * tests/integration.test.ts
 *
 * End-to-end integration tests that call unisights() and exercise
 * the full stack — factory → adapter — just as a real app would.
 */

import { describe, it, expect, vi } from "vitest";
import { unisights } from "../index.js";
import {
  makeMockReq,
  makeMockRes,
  makeFetchRequest,
  makeMockHonoCtx,
  makeMockKoaCtx,
  makeMockElysiaApp,
} from "./helpers.js";

// ── Node middleware (Express / NestJS / raw http) ─────────────────────────────

describe("integration — Node middleware", () => {
  it("receives payload and calls handler via app.use(collector)", async () => {
    const handler = vi.fn();
    const collector = unisights({ path: "/collect", handler });

    const req = makeMockReq({ url: "/collect", body: { event: "signup" } });
    const res = makeMockRes();
    collector(req as any, res as any);
    await res.done;

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual({ event: "signup" });
  });

  it("returns 200 { ok: true } always", async () => {
    const collector = unisights({ path: "/collect" });
    const req = makeMockReq({ url: "/collect", body: { x: 1 } });
    const res = makeMockRes();
    collector(req as any, res as any);
    const result = await res.done;
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ok: true });
  });

  it("passes through non-matching requests to next()", async () => {
    const collector = unisights({ path: "/collect" });
    const req = makeMockReq({ url: "/other" });
    const res = makeMockRes();
    const next = vi.fn();
    collector(req as any, res as any, next);
    await new Promise((r) => setTimeout(r, 20));
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not call handler when none configured", async () => {
    const collector = unisights({ path: "/collect" });
    const req = makeMockReq({ url: "/collect", body: {} });
    const res = makeMockRes();
    collector(req as any, res as any);
    const result = await res.done;
    expect(JSON.parse(result.body)).toEqual({ ok: true });
  });
});

// ── Fetch API (Cloudflare Workers / Deno / Bun) ───────────────────────────────

describe("integration — collector.fetch", () => {
  it("receives payload and calls handler", async () => {
    const handler = vi.fn();
    const collector = unisights({ path: "/collect", handler });
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: { page: "/home" },
    });
    const res = await collector.fetch(req);
    expect(res?.status).toBe(200);
    expect(handler).toHaveBeenCalledWith({ page: "/home" }, req);
  });

  it("returns null for non-matching paths", async () => {
    const collector = unisights({ path: "/collect" });
    const req = makeFetchRequest({ url: "http://localhost/other" });
    expect(await collector.fetch(req)).toBeNull();
  });

  it("always returns 200 even when handler throws", async () => {
    const collector = unisights({
      path: "/collect",
      handler: async () => {
        throw new Error("oops");
      },
    });
    const req = makeFetchRequest({ url: "http://localhost/collect", body: {} });
    const res = await collector.fetch(req);
    expect(res?.status).toBe(200);
  });
});

// ── Hono ──────────────────────────────────────────────────────────────────────

describe("integration — collector.hono", () => {
  it("receives payload and calls handler", async () => {
    const handler = vi.fn();
    const collector = unisights({ path: "/collect", handler });
    const ctx = makeMockHonoCtx({
      url: "http://localhost/collect",
      body: { a: 1 },
    });
    await collector.hono(ctx as any, async () => {});
    expect(handler).toHaveBeenCalledWith({ a: 1 }, ctx);
  });

  it("returns 200 response", async () => {
    const collector = unisights({ path: "/collect" });
    const ctx = makeMockHonoCtx({ url: "http://localhost/collect", body: {} });
    const res = (await collector.hono(ctx as any, async () => {})) as Response;
    expect(res.status).toBe(200);
  });
});

// ── Koa ───────────────────────────────────────────────────────────────────────

describe("integration — collector.koa", () => {
  it("receives payload and calls handler", async () => {
    const handler = vi.fn();
    const collector = unisights({ path: "/collect", handler });
    const ctx = makeMockKoaCtx({ path: "/collect", requestBody: { b: 2 } });
    await collector.koa(ctx as any, async () => {});
    expect(handler).toHaveBeenCalledWith({ b: 2 }, ctx);
  });

  it("sets ctx.status = 200 and ctx.body = { ok: true }", async () => {
    const collector = unisights({ path: "/collect" });
    const ctx = makeMockKoaCtx({ path: "/collect", requestBody: {} });
    await collector.koa(ctx as any, async () => {});
    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({ ok: true });
  });
});

// ── Elysia ────────────────────────────────────────────────────────────────────

describe("integration — collector.elysia", () => {
  it("registers route and calls handler with body", async () => {
    const handler = vi.fn();
    const collector = unisights({ path: "/collect", handler });
    const app = makeMockElysiaApp();
    collector.elysia(app as any);
    await app.callPost({ c: 3 });
    expect(handler).toHaveBeenCalledWith({ c: 3 }, expect.anything());
  });

  it("returns { ok: true }", async () => {
    const collector = unisights({ path: "/collect" });
    const app = makeMockElysiaApp();
    collector.elysia(app as any);
    const result = await app.callPost({});
    expect(result).toEqual({ ok: true });
  });
});

// ── Cross-surface — same handler called from different adapters ───────────────

describe("integration — same collector across multiple surfaces", () => {
  it("routes to the same handler regardless of surface used", async () => {
    const received: unknown[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    // Via Node middleware
    const req1 = makeMockReq({ url: "/collect", body: { from: "node" } });
    const res1 = makeMockRes();
    collector(req1 as any, res1 as any);
    await res1.done;

    // Via fetch
    const req2 = makeFetchRequest({
      url: "http://localhost/collect",
      body: { from: "fetch" },
    });
    await collector.fetch(req2);

    // Via hono
    const ctx3 = makeMockHonoCtx({
      url: "http://localhost/collect",
      body: { from: "hono" },
    });
    await collector.hono(ctx3 as any, async () => {});

    expect(received).toEqual([
      { from: "node" },
      { from: "fetch" },
      { from: "hono" },
    ]);
  });
});
