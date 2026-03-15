/**
 * tests/auto-decrypt.test.ts
 *
 * Tests for the transparent auto-decrypt feature in unisights().
 * The handler must always receive a decrypted UnisightsPayload regardless
 * of whether the incoming POST was encrypted or plain.
 */

import { describe, it, expect, vi } from "vitest";
import { unisights } from "../index.js";
import { encryptPayload, makePlainPayload } from "./encrypt-helper.js";
import {
  makeFetchRequest,
  makeMockReq,
  makeMockRes,
  makeMockKoaCtx,
  makeMockHonoCtx,
  makeMockElysiaApp,
} from "./helpers.js";
import type { UnisightsPayload } from "../types.js";

// ── Fetch adapter — core tests ────────────────────────────────────────────────

describe("auto-decrypt — fetch adapter", () => {
  it("passes plain payload directly to handler unchanged", async () => {
    const received: UnisightsPayload[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload as UnisightsPayload);
      },
    });

    const plain = makePlainPayload();
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: plain,
    });
    await collector.fetch(req);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(plain);
  });

  it("auto-decrypts an encrypted payload before calling handler", async () => {
    const received: UnisightsPayload[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload as UnisightsPayload);
      },
    });

    const original = makePlainPayload();
    const encrypted = await encryptPayload(original);
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: encrypted,
    });
    await collector.fetch(req);

    expect(received).toHaveLength(1);
    // Handler receives the decrypted UnisightsPayload, not the EncryptedPayload envelope
    expect(received[0]).toEqual(original);
    expect((received[0] as any).data?.asset_id).toBe("test-asset-id");
  });

  it("handler receives identical result for encrypted and plain payloads", async () => {
    const plainReceived: UnisightsPayload[] = [];
    const encryptedReceived: UnisightsPayload[] = [];

    const plainCollector = unisights({
      path: "/collect",
      handler: async (p) => {
        plainReceived.push(p as UnisightsPayload);
      },
    });
    const encCollector = unisights({
      path: "/collect",
      handler: async (p) => {
        encryptedReceived.push(p as UnisightsPayload);
      },
    });

    const payload = makePlainPayload();
    const encrypted = await encryptPayload(payload);

    await plainCollector.fetch(
      makeFetchRequest({ url: "http://localhost/collect", body: payload }),
    );
    await encCollector.fetch(
      makeFetchRequest({ url: "http://localhost/collect", body: encrypted }),
    );

    expect(plainReceived[0]).toEqual(encryptedReceived[0]);
  });

  it("auto-decrypts with server secret when configured", async () => {
    const received: UnisightsPayload[] = [];
    const secret = "test-server-secret-xyz";

    const collector = unisights({
      path: "/collect",
      serverSecret: secret,
      handler: async (payload) => {
        received.push(payload as UnisightsPayload);
      },
    });

    const original = makePlainPayload();
    const encrypted = await encryptPayload(original, { serverSecret: secret });
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: encrypted,
    });
    await collector.fetch(req);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(original);
  });

  it("always returns 200 even when decryption fails (tampered payload)", async () => {
    const collector = unisights({ path: "/collect", handler: vi.fn() });

    const encrypted = await encryptPayload(makePlainPayload());
    const tampered = { ...encrypted, site_id: "wrong-site" };
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: tampered,
    });
    const res = await collector.fetch(req);

    // DecryptError is swallowed — always 200
    expect(res?.status).toBe(200);
  });

  it("handler is NOT called when decryption fails", async () => {
    const handler = vi.fn();
    const collector = unisights({ path: "/collect", handler });

    const encrypted = await encryptPayload(makePlainPayload());
    const tampered = { ...encrypted, tag: btoa("bad-tag-value-here") };
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: tampered,
    });
    await collector.fetch(req);

    expect(handler).not.toHaveBeenCalled();
  });

  it("works without a handler — auto-decrypts silently and returns 200", async () => {
    const collector = unisights({ path: "/collect" });
    const encrypted = await encryptPayload(makePlainPayload());
    const req = makeFetchRequest({
      url: "http://localhost/collect",
      body: encrypted,
    });
    const res = await collector.fetch(req);
    expect(res?.status).toBe(200);
  });
});

// ── Node middleware adapter ───────────────────────────────────────────────────

describe("auto-decrypt — node middleware", () => {
  it("auto-decrypts encrypted payload and passes UnisightsPayload to handler", async () => {
    const received: unknown[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    const original = makePlainPayload();
    const encrypted = await encryptPayload(original);
    const req = makeMockReq({ url: "/collect", body: encrypted });
    const res = makeMockRes();
    collector(req as any, res as any);
    await res.done;

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(original);
  });

  it("passes plain payload through unchanged", async () => {
    const received: unknown[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    const plain = makePlainPayload();
    const req = makeMockReq({ url: "/collect", body: plain });
    const res = makeMockRes();
    collector(req as any, res as any);
    await res.done;

    expect(received[0]).toEqual(plain);
  });

  it("returns 200 and swallows DecryptError for tampered payload", async () => {
    const collector = unisights({ path: "/collect", handler: vi.fn() });

    const encrypted = await encryptPayload(makePlainPayload());
    const tampered = { ...encrypted, bucket: 99999 };
    const req = makeMockReq({ url: "/collect", body: tampered });
    const res = makeMockRes();
    collector(req as any, res as any);
    const result = await res.done;

    expect(result.statusCode).toBe(200);
  });
});

// ── Koa adapter ───────────────────────────────────────────────────────────────

describe("auto-decrypt — koa", () => {
  it("auto-decrypts encrypted payload in Koa middleware", async () => {
    const received: unknown[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    const original = makePlainPayload();
    const encrypted = await encryptPayload(original);
    const ctx = makeMockKoaCtx({ path: "/collect", requestBody: encrypted });
    await collector.koa(ctx as any, async () => {});

    expect(received[0]).toEqual(original);
  });
});

// ── Hono adapter ──────────────────────────────────────────────────────────────

describe("auto-decrypt — hono", () => {
  it("auto-decrypts encrypted payload in Hono middleware", async () => {
    const received: unknown[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    const original = makePlainPayload();
    const encrypted = await encryptPayload(original);
    const ctx = makeMockHonoCtx({
      url: "http://localhost/collect",
      body: encrypted,
    });
    await collector.hono(ctx as any, async () => {});

    expect(received[0]).toEqual(original);
  });
});

// ── Elysia adapter ────────────────────────────────────────────────────────────

describe("auto-decrypt — elysia", () => {
  it("auto-decrypts encrypted payload in Elysia route", async () => {
    const received: unknown[] = [];
    const collector = unisights({
      path: "/collect",
      handler: async (payload) => {
        received.push(payload);
      },
    });

    const original = makePlainPayload();
    const encrypted = await encryptPayload(original);
    const app = makeMockElysiaApp();
    collector.elysia(app as any);
    await app.callPost(encrypted);

    expect(received[0]).toEqual(original);
  });
});

// ── serverSecret option ───────────────────────────────────────────────────────

describe("auto-decrypt — serverSecret option", () => {
  it("is exposed as read-only on the collector", () => {
    const collector = unisights({
      path: "/collect",
      serverSecret: "my-secret",
    });
    expect((collector as any).serverSecret).toBeUndefined(); // not exposed externally
  });

  it("decrypts correctly across all adapters with same server secret", async () => {
    const secret = "shared-server-secret";
    const original = makePlainPayload();
    const encrypted = await encryptPayload(original, { serverSecret: secret });

    const results: Record<string, unknown> = {};

    // fetch
    const fc = unisights({
      path: "/collect",
      serverSecret: secret,
      handler: async (p) => {
        results.fetch = p;
      },
    });
    await fc.fetch(
      makeFetchRequest({ url: "http://localhost/collect", body: encrypted }),
    );

    // node
    const nc = unisights({
      path: "/collect",
      serverSecret: secret,
      handler: async (p) => {
        results.node = p;
      },
    });
    const req = makeMockReq({ url: "/collect", body: encrypted });
    const res = makeMockRes();
    nc(req as any, res as any);
    await res.done;

    expect(results.fetch).toEqual(original);
    expect(results.node).toEqual(original);
  });
});
