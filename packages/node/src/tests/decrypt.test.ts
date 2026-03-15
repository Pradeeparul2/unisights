/**
 * tests/decrypt.test.ts
 *
 * Tests for:
 *   - isEncrypted() type guard
 *   - decrypt() — round-trip, server secret, tag tamper, JSON error
 *   - DecryptError class
 */

import { describe, it, expect } from "vitest";
import { decrypt, isEncrypted, DecryptError } from "../decrypt.js";
import { encryptPayload, makePlainPayload } from "./encrypt-helper.js";
import type { EncryptedPayload } from "../types.js";

// ── isEncrypted ───────────────────────────────────────────────────────────────

describe("isEncrypted", () => {
  it("returns true for a well-formed EncryptedPayload", async () => {
    const plain = makePlainPayload();
    const enc = await encryptPayload(plain);
    expect(isEncrypted(enc)).toBe(true);
  });

  it("returns false for a plain UnisightsPayload (encrypted: false)", () => {
    const plain = makePlainPayload();
    expect(isEncrypted(plain)).toBe(false);
  });

  it("returns false when encrypted field is missing", () => {
    const obj = {
      data: "abc",
      tag: "xyz",
      bucket: 1,
      site_id: "s",
      ua_hash: "h",
    };
    expect(isEncrypted(obj)).toBe(false);
  });

  it("returns false when encrypted is false", () => {
    const obj = {
      data: "abc",
      tag: "xyz",
      bucket: 1,
      site_id: "s",
      ua_hash: "h",
      encrypted: false,
    };
    expect(isEncrypted(obj)).toBe(false);
  });

  it("returns false when data field is missing", () => {
    const obj: Partial<EncryptedPayload> = {
      tag: "xyz",
      bucket: 1,
      site_id: "s",
      ua_hash: "h",
      encrypted: true,
    };
    expect(isEncrypted(obj)).toBe(false);
  });

  it("returns false when tag field is missing", () => {
    const obj: Partial<EncryptedPayload> = {
      data: "abc",
      bucket: 1,
      site_id: "s",
      ua_hash: "h",
      encrypted: true,
    };
    expect(isEncrypted(obj)).toBe(false);
  });

  it("returns false when bucket is not a number", () => {
    const obj = {
      data: "abc",
      tag: "xyz",
      bucket: "123",
      site_id: "s",
      ua_hash: "h",
      encrypted: true,
    };
    expect(isEncrypted(obj)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEncrypted(null)).toBe(false);
  });

  it("returns false for a plain string", () => {
    expect(isEncrypted("hello")).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isEncrypted([])).toBe(false);
  });
});

// ── decrypt — round-trip ──────────────────────────────────────────────────────

describe("decrypt — round-trip", () => {
  it("decrypts a payload back to the original object", async () => {
    const original = makePlainPayload();
    const enc = await encryptPayload(original);
    const result = await decrypt(enc);
    expect(result).toEqual(original);
  });

  it("decrypts payloads with multiple events", async () => {
    const original = makePlainPayload();
    original.data.events = [
      {
        type: "page_view",
        data: {
          location: "https://example.com",
          title: "Home",
          timestamp: 1710000000000,
        },
      },
      { type: "click", data: { x: 340, y: 210, timestamp: 1710000005000 } },
      {
        type: "web_vital",
        data: {
          name: "LCP",
          value: 1200,
          rating: "good",
          delta: 1200,
          id: "v1",
          entries: 1,
          navigation_type: "navigate",
          timestamp: 1710000010000,
        },
      },
      {
        type: "error",
        data: {
          message: "TypeError: null",
          source: "app.js",
          lineno: 42,
          colno: 7,
          timestamp: 1710000020000,
        },
      },
      {
        type: "custom",
        data: {
          name: "purchase",
          data: '{"amount":49.99}',
          timestamp: 1710000015000,
        },
      },
    ];
    const enc = await encryptPayload(original);
    const result = await decrypt(enc);
    expect(result.data.events).toHaveLength(5);
    expect(result.data.events[0].type).toBe("page_view");
    expect(result.data.events[1].type).toBe("click");
    expect(result.data.events[2].type).toBe("web_vital");
    expect(result.data.events[3].type).toBe("error");
    expect(result.data.events[4].type).toBe("custom");
  });

  it("preserves all UnisightsData fields accurately", async () => {
    const original = makePlainPayload();
    original.data.scroll_depth = 87.3;
    original.data.time_on_page = 123.4;
    original.data.exit_page = "https://example.com/bye";
    original.data.utm_params = {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "q4",
    };
    original.data.device_info = {
      browser: "Firefox",
      os: "Windows",
      device_type: "Desktop",
    };
    const enc = await encryptPayload(original);
    const result = await decrypt(enc);
    expect(result.data.scroll_depth).toBe(87.3);
    expect(result.data.time_on_page).toBe(123.4);
    expect(result.data.exit_page).toBe("https://example.com/bye");
    expect(result.data.utm_params).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "q4",
    });
    expect(result.data.device_info.browser).toBe("Firefox");
  });

  it("is deterministic — same inputs always decrypt to same result", async () => {
    const original = makePlainPayload();
    const enc = await encryptPayload(original, {
      siteId: "my-site",
      bucket: 12345,
      uaHash: "abc123",
    });
    const r1 = await decrypt(enc);
    const r2 = await decrypt(enc);
    expect(r1).toEqual(r2);
  });

  it("handles large payloads spanning multiple keystream chunks (>32 bytes)", async () => {
    const original = makePlainPayload();
    // Add enough events to push payload well beyond 32 bytes
    original.data.events = Array.from({ length: 20 }, (_, i) => ({
      type: "click" as const,
      data: { x: i * 10, y: i * 5, timestamp: 1710000000000 + i * 1000 },
    }));
    const enc = await encryptPayload(original);
    const result = await decrypt(enc);
    expect(result.data.events).toHaveLength(20);
  });

  it("works with different bucket values (key rotation)", async () => {
    const original = makePlainPayload();
    const enc1 = await encryptPayload(original, { bucket: 1000 });
    const enc2 = await encryptPayload(original, { bucket: 2000 });
    // Both should decrypt correctly with their own bucket
    expect(await decrypt(enc1)).toEqual(original);
    expect(await decrypt(enc2)).toEqual(original);
  });

  it("works with unicode content in payload", async () => {
    const original = makePlainPayload();
    original.data.page_url = "https://example.com/日本語";
    const enc = await encryptPayload(original);
    const result = await decrypt(enc);
    expect(result.data.page_url).toBe("https://example.com/日本語");
  });
});

// ── decrypt — server secret ───────────────────────────────────────────────────

describe("decrypt — server secret (key wrapping)", () => {
  it("decrypts when the same server secret is provided", async () => {
    const original = makePlainPayload();
    const secret = "my-server-secret-key";
    const enc = await encryptPayload(original, { serverSecret: secret });
    const result = await decrypt(enc, { serverSecret: secret });
    expect(result).toEqual(original);
  });

  it("throws DecryptError when server secret is wrong", async () => {
    const original = makePlainPayload();
    const enc = await encryptPayload(original, {
      serverSecret: "correct-secret",
    });
    await expect(
      decrypt(enc, { serverSecret: "wrong-secret" }),
    ).rejects.toBeInstanceOf(DecryptError);
  });

  it("throws DecryptError when server secret is missing but was used during encrypt", async () => {
    const original = makePlainPayload();
    const enc = await encryptPayload(original, { serverSecret: "some-secret" });
    // Attempting to decrypt without the secret produces a different key → tag mismatch
    await expect(decrypt(enc)).rejects.toBeInstanceOf(DecryptError);
  });

  it("throws DecryptError when server secret is provided but was not used during encrypt", async () => {
    const original = makePlainPayload();
    const enc = await encryptPayload(original); // no serverSecret
    await expect(
      decrypt(enc, { serverSecret: "unexpected-secret" }),
    ).rejects.toBeInstanceOf(DecryptError);
  });

  it("different server secrets produce different keys (encryption isolation)", async () => {
    const original = makePlainPayload();
    const enc1 = await encryptPayload(original, { serverSecret: "secret-a" });
    const enc2 = await encryptPayload(original, { serverSecret: "secret-b" });
    // ciphertexts should differ because keys differ
    expect(enc1.data).not.toBe(enc2.data);
    expect(enc1.tag).not.toBe(enc2.tag);
  });
});

// ── decrypt — tag tamper (security) ──────────────────────────────────────────

describe("decrypt — tag verification", () => {
  it("throws DecryptError when the HMAC tag is tampered", async () => {
    const enc = await encryptPayload(makePlainPayload());
    // Flip a byte in the base64-decoded tag
    const tagBytes = Array.from(atob(enc.tag), (c) => c.charCodeAt(0));
    tagBytes[0] ^= 0xff;
    const tampered: EncryptedPayload = {
      ...enc,
      tag: btoa(String.fromCharCode(...tagBytes)),
    };
    await expect(decrypt(tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("throws DecryptError when the ciphertext is tampered", async () => {
    const enc = await encryptPayload(makePlainPayload());
    const dataBytes = Array.from(atob(enc.data), (c) => c.charCodeAt(0));
    dataBytes[5] ^= 0x01;
    const tampered: EncryptedPayload = {
      ...enc,
      data: btoa(String.fromCharCode(...dataBytes)),
    };
    await expect(decrypt(tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("throws DecryptError when bucket is wrong", async () => {
    const enc = await encryptPayload(makePlainPayload(), { bucket: 1000 });
    const tampered: EncryptedPayload = { ...enc, bucket: 9999 };
    await expect(decrypt(tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("throws DecryptError when site_id is wrong", async () => {
    const enc = await encryptPayload(makePlainPayload(), {
      siteId: "real-site",
    });
    const tampered: EncryptedPayload = { ...enc, site_id: "fake-site" };
    await expect(decrypt(tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("throws DecryptError when ua_hash is wrong", async () => {
    const enc = await encryptPayload(makePlainPayload(), {
      uaHash: "real-hash",
    });
    const tampered: EncryptedPayload = { ...enc, ua_hash: "fake-hash" };
    await expect(decrypt(tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("DecryptError has correct name property", async () => {
    const enc = await encryptPayload(makePlainPayload());
    const tampered: EncryptedPayload = { ...enc, site_id: "wrong" };
    const err = await decrypt(tampered).catch((e) => e);
    expect(err.name).toBe("DecryptError");
  });

  it("DecryptError is instanceof Error", () => {
    const err = new DecryptError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DecryptError);
  });
});
