/**
 * tests/adapter.fastify.test.ts
 * Unit tests for the Fastify plugin adapter.
 */

import { describe, it, expect, vi } from "vitest";
import { fastifyAdapter } from "../adapters/fastify.js";

// ── Minimal Fastify mock ──────────────────────────────────────────────────────

interface RouteHandler {
  (request: MockFastifyRequest, reply: MockFastifyReply): Promise<void>;
}

interface MockFastifyRequest {
  body?: unknown;
  raw?: unknown;
}

interface MockFastifyReply {
  _status: number;
  _body: unknown;
  code(n: number): MockFastifyReply;
  send(body: unknown): void;
}

function makeMockFastify() {
  const routes: Record<string, RouteHandler> = {};
  let ctParser:
    | ((
        req: unknown,
        body: string,
        done: (e: Error | null, v?: unknown) => void,
      ) => void)
    | null = null;

  const fastify = {
    addContentTypeParser(_ct: string, _opts: unknown, fn: typeof ctParser) {
      ctParser = fn;
    },
    post(path: string, handler: RouteHandler) {
      routes[path] = handler;
    },
    options(_path: string, _handler: RouteHandler) {},
    // Helper to trigger a route
    async callRoute(
      path: string,
      body: unknown,
    ): Promise<{ status: number; body: unknown }> {
      const req: MockFastifyRequest = { body };
      const reply: MockFastifyReply = {
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
    parseBody(raw: string): unknown {
      if (!ctParser) throw new Error("No content type parser registered");
      return new Promise((resolve, reject) => {
        ctParser!(null, raw, (err, val) => {
          if (err) reject(err);
          else resolve(val);
        });
      });
    },
  };

  return fastify;
}

function makePlugin(handler = null as any, path = "/events") {
  return fastifyAdapter({ path, handler });
}

// ── Plugin registration ───────────────────────────────────────────────────────

describe("fastifyAdapter — plugin registration", () => {
  it("registers a POST route at the configured path", async () => {
    const plugin = makePlugin();
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    const result = await fastify.callRoute("/events", {});
    expect(result.status).toBe(200);
  });

  it("has skip-override symbol set (Fastify plugin metadata)", () => {
    const plugin = makePlugin();
    expect((plugin as any)[Symbol.for("skip-override")]).toBe(true);
  });

  it('has fastify.display-name set to "unisights"', () => {
    const plugin = makePlugin();
    expect((plugin as any)[Symbol.for("fastify.display-name")]).toBe(
      "unisights",
    );
  });

  it("registers a content type parser for application/json", async () => {
    const plugin = makePlugin();
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    // Valid JSON should parse cleanly
    const result = await fastify.parseBody('{"x":1}');
    expect(result).toEqual({ x: 1 });
  });

  it("content type parser returns empty object for invalid JSON (no throw)", async () => {
    const plugin = makePlugin();
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    const result = await fastify.parseBody("{bad json");
    expect(result).toEqual({});
  });
});

// ── Always 200 ────────────────────────────────────────────────────────────────

describe("fastifyAdapter — always 200", () => {
  it("returns 200 { ok: true } for a valid request", async () => {
    const plugin = makePlugin();
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    const result = await fastify.callRoute("/events", { event: "click" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("returns 200 even when handler throws", async () => {
    const plugin = makePlugin(async () => {
      throw new Error("boom");
    });
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    const result = await fastify.callRoute("/events", { x: 1 });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });
});

// ── Handler invocation ────────────────────────────────────────────────────────

describe("fastifyAdapter — handler", () => {
  it("calls handler with the parsed body", async () => {
    const handler = vi.fn();
    const plugin = makePlugin(handler);
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    const payload = { userId: "u99", page: "/dashboard" };
    await fastify.callRoute("/events", payload);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toEqual(payload);
  });

  it("works without a handler (null)", async () => {
    const plugin = makePlugin(null);
    const fastify = makeMockFastify() as any;
    await plugin(fastify, {});
    const result = await fastify.callRoute("/events", {});
    expect(result.body).toEqual({ ok: true });
  });
});
