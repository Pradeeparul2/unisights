/**
 * tests/parseBody.test.ts
 * Unit tests for the parseBody utility.
 */

import { describe, it, expect } from "vitest";
import { parseBody, createError } from "../parseBody.js";
import { makeMockReq, makeFetchRequest } from "./helpers.js";

// ── createError ───────────────────────────────────────────────────────────────

describe("createError", () => {
  it("creates an Error with the given message", () => {
    const err = createError(400, "Bad input");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Bad input");
  });

  it("attaches the status code as a property", () => {
    const err = createError(415, "Unsupported");
    expect((err as Error & { status: number }).status).toBe(415);
  });
});

// ── parseBody — pre-parsed body (Express / Fastify style) ─────────────────────

describe("parseBody — pre-parsed body", () => {
  it("returns body as-is when it is a plain object", async () => {
    const req = makeMockReq({ body: { user: "alice", action: "click" } });
    const result = await parseBody(req);
    expect(result).toEqual({ user: "alice", action: "click" });
  });

  it("returns body as-is when it is an array", async () => {
    const req = makeMockReq({ body: [1, 2, 3] });
    const result = await parseBody(req);
    expect(result).toEqual([1, 2, 3]);
  });

  it("JSON-parses body when it is a string", async () => {
    const req = makeMockReq({ body: '{"x":1}' });
    const result = await parseBody(req);
    expect(result).toEqual({ x: 1 });
  });

  it("throws on invalid JSON string body", async () => {
    const req = makeMockReq({ body: "not-json" });
    await expect(parseBody(req)).rejects.toThrow("Invalid JSON body");
  });

  it("returns body when it is a number (primitive)", async () => {
    const req = makeMockReq({ body: 42 });
    const result = await parseBody(req);
    expect(result).toBe(42);
  });
});

// ── parseBody — Web Fetch API Request ─────────────────────────────────────────

describe("parseBody — Web Fetch API Request", () => {
  it("parses a valid JSON body from a Fetch Request", async () => {
    const req = makeFetchRequest({
      body: { event: "page_view", url: "/home" },
    });
    const result = await parseBody(req);
    expect(result).toEqual({ event: "page_view", url: "/home" });
  });

  it("parses deeply nested payloads", async () => {
    const payload = { a: { b: { c: [1, 2, 3] } } };
    const req = makeFetchRequest({ body: payload });
    const result = await parseBody(req);
    expect(result).toEqual(payload);
  });

  it("throws on empty body from Fetch Request", async () => {
    const req = new Request("http://localhost/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    });
    await expect(parseBody(req)).rejects.toThrow("Empty request body");
  });

  it("throws on invalid JSON from Fetch Request", async () => {
    const req = new Request("http://localhost/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad json",
    });
    await expect(parseBody(req)).rejects.toThrow("Invalid JSON body");
  });
});

// ── parseBody — Raw Node stream ───────────────────────────────────────────────

describe("parseBody — raw Node stream", () => {
  it("reads and parses a streamed JSON body", async () => {
    const req = makeMockReq({ body: undefined }); // no pre-parsed body
    const payload = { type: "scroll", depth: 0.75 };
    const promise = parseBody(req);
    req.simulateBody(payload);
    expect(await promise).toEqual(payload);
  });

  it("parses a streamed body with multiple chunks", async () => {
    const req = makeMockReq({ body: undefined });
    const promise = parseBody(req);
    const full = JSON.stringify({ key: "value" });
    // Split into two chunks
    process.nextTick(() => {
      req.emit("data", Buffer.from(full.slice(0, 5)));
      req.emit("data", Buffer.from(full.slice(5)));
      req.emit("end");
    });
    expect(await promise).toEqual({ key: "value" });
  });

  it("rejects when the stream emits an error", async () => {
    const req = makeMockReq({ body: undefined });
    const promise = parseBody(req);
    process.nextTick(() => req.emit("error", new Error("stream broken")));
    await expect(promise).rejects.toThrow("stream broken");
  });

  it("rejects on empty streamed body", async () => {
    const req = makeMockReq({ body: undefined });
    const promise = parseBody(req);
    process.nextTick(() => {
      req.emit("data", Buffer.from(""));
      req.emit("end");
    });
    await expect(promise).rejects.toThrow("Empty request body");
  });

  it("rejects on invalid JSON in streamed body", async () => {
    const req = makeMockReq({ body: undefined });
    const promise = parseBody(req);
    process.nextTick(() => {
      req.emit("data", Buffer.from("{bad"));
      req.emit("end");
    });
    await expect(promise).rejects.toThrow("Invalid JSON body");
  });
});

// ── parseBody — unrecognised request ─────────────────────────────────────────

describe("parseBody — unrecognised request type", () => {
  it("throws when the request is not a recognised type", async () => {
    const weird = { totally: "unknown" };
    await expect(parseBody(weird)).rejects.toThrow("Cannot read request body");
  });

  it("throws when req is null", async () => {
    await expect(parseBody(null)).rejects.toThrow();
  });
});
