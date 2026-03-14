/**
 * tests/index.test.ts
 * Unit tests for the unisights() factory function.
 */

import { describe, it, expect, vi } from "vitest";
import { unisights } from "../index.js";

// ── Factory validation ────────────────────────────────────────────────────────

describe("unisights() — factory validation", () => {
  it("creates a collector with default path /events when no options given", () => {
    const collector = unisights();
    expect(collector.path).toBe("/events");
  });

  it("uses the provided custom path", () => {
    const collector = unisights({ path: "/collect" });
    expect(collector.path).toBe("/collect");
  });

  it("stores null handler when none provided", () => {
    const collector = unisights({ path: "/collect" });
    expect(collector.handler).toBeNull();
  });

  it("stores the provided handler", () => {
    const handler = vi.fn();
    const collector = unisights({ handler });
    expect(collector.handler).toBe(handler);
  });

  it('throws when path does not start with "/"', () => {
    expect(() => unisights({ path: "no-slash" })).toThrow(
      '[unisights] options.path must be a string starting with "/"',
    );
  });

  it("throws when path is not a string", () => {
    // @ts-expect-error intentional bad input
    expect(() => unisights({ path: 123 })).toThrow();
  });

  it("throws when handler is not a function", () => {
    // @ts-expect-error intentional bad input
    expect(() => unisights({ handler: "not-a-function" })).toThrow(
      "[unisights] options.handler must be a function",
    );
  });

  it("path is read-only", () => {
    const collector = unisights({ path: "/collect" });
    expect(() => {
      // @ts-expect-error intentional write to read-only
      collector.path = "/other";
    }).toThrow();
  });

  it("handler is read-only", () => {
    const collector = unisights({ path: "/collect" });
    expect(() => {
      // @ts-expect-error intentional write to read-only
      collector.handler = vi.fn();
    }).toThrow();
  });
});

// ── Collector surfaces ────────────────────────────────────────────────────────

describe("unisights() — returned collector surfaces", () => {
  it("is callable as a function (Node middleware shape)", () => {
    const collector = unisights();
    expect(typeof collector).toBe("function");
  });

  it("exposes a .fastify plugin function", () => {
    const collector = unisights();
    expect(typeof collector.fastify).toBe("function");
  });

  it("exposes a .koa middleware function", () => {
    const collector = unisights();
    expect(typeof collector.koa).toBe("function");
  });

  it("exposes a .fetch handler function", () => {
    const collector = unisights();
    expect(typeof collector.fetch).toBe("function");
  });

  it("exposes a .hono middleware function", () => {
    const collector = unisights();
    expect(typeof collector.hono).toBe("function");
  });

  it("exposes an .elysia plugin function", () => {
    const collector = unisights();
    expect(typeof collector.elysia).toBe("function");
  });
});

// ── Generic type inference (runtime check via handler argument) ───────────────

describe("unisights() — generic TPayload", () => {
  it("handler receives the parsed payload", async () => {
    interface ClickEvent {
      x: number;
      y: number;
    }
    const received: ClickEvent[] = [];

    const collector = unisights<ClickEvent>({
      path: "/events",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    // Call through the fetch surface to trigger the handler
    const req = new Request("http://localhost/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: 10, y: 20 }),
    });
    await collector.fetch(req);
    expect(received).toEqual([{ x: 10, y: 20 }]);
  });
});
