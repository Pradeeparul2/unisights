/**
 * tests/encrypt-helper.ts
 *
 * Test-only encryption helper that mirrors the Rust/WASM core algorithm.
 * Used to produce real EncryptedPayload fixtures for decrypt.test.ts and
 * integration tests — never shipped in the package.
 */

import type { EncryptedPayload, UnisightsPayload } from "../types.js";

// ── Byte helpers ──────────────────────────────────────────────────────────────

function ab(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength,
  ) as ArrayBuffer;
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

function base64Encode(u8: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

function uint64be(n: number): Uint8Array {
  const buf = new Uint8Array(8);
  const hi = Math.floor(n / 0x100000000);
  const lo = n >>> 0;
  buf[0] = (hi >>> 24) & 0xff;
  buf[1] = (hi >>> 16) & 0xff;
  buf[2] = (hi >>> 8) & 0xff;
  buf[3] = hi & 0xff;
  buf[4] = (lo >>> 24) & 0xff;
  buf[5] = (lo >>> 16) & 0xff;
  buf[6] = (lo >>> 8) & 0xff;
  buf[7] = lo & 0xff;
  return buf;
}

// ── Key derivation (mirrors decrypt.ts) ──────────────────────────────────────

async function deriveClientKey(
  siteId: string,
  bucket: number,
  uaHash: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const input = concat([
    enc.encode(siteId),
    enc.encode(":"),
    uint64be(bucket),
    enc.encode(":"),
    enc.encode(uaHash),
  ]);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", ab(input)));
}

async function wrapWithServerSecret(
  serverSecret: string,
  clientKey: Uint8Array,
): Promise<Uint8Array> {
  const secretBytes = new TextEncoder().encode(serverSecret);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    ab(secretBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, ab(clientKey)),
  );
}

async function xorEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const chunks = Math.ceil(plaintext.length / 32);
  const keystream = new Uint8Array(chunks * 32);
  for (let chunk = 0; chunk < chunks; chunk++) {
    const counter = new Uint8Array([
      (chunk >>> 24) & 0xff,
      (chunk >>> 16) & 0xff,
      (chunk >>> 8) & 0xff,
      chunk & 0xff,
    ]);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      ab(concat([key, counter])),
    );
    keystream.set(new Uint8Array(digest), chunk * 32);
  }
  const ciphertext = new Uint8Array(plaintext.length);
  for (let i = 0; i < plaintext.length; i++)
    ciphertext[i] = plaintext[i] ^ keystream[i];
  return ciphertext;
}

async function computeTag(
  key: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    ab(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, ab(ciphertext)),
  );
}

// ── Public helpers ────────────────────────────────────────────────────────────

export interface EncryptOptions {
  siteId?: string;
  bucket?: number;
  uaHash?: string;
  serverSecret?: string;
}

/**
 * Encrypt a UnisightsPayload using the same algorithm as the Rust/WASM core.
 * Returns an EncryptedPayload ready to POST (or pass directly to decrypt()).
 */
export async function encryptPayload(
  payload: UnisightsPayload,
  opts: EncryptOptions = {},
): Promise<EncryptedPayload> {
  const siteId = opts.siteId ?? "test-site-id";
  const bucket = opts.bucket ?? 56_666_667;
  const uaHash = opts.uaHash ?? "f9a23babc123def456";

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  let key = await deriveClientKey(siteId, bucket, uaHash);
  if (opts.serverSecret) {
    key = await wrapWithServerSecret(opts.serverSecret, key);
  }

  const ciphertext = await xorEncrypt(key, plaintext);
  const tag = await computeTag(key, ciphertext);

  return {
    data: base64Encode(ciphertext),
    tag: base64Encode(tag),
    bucket,
    site_id: siteId,
    ua_hash: uaHash,
    encrypted: true,
  };
}

/** Minimal valid UnisightsPayload for use in tests */
export function makePlainPayload(
  overrides: Partial<UnisightsPayload> = {},
): UnisightsPayload {
  return {
    data: {
      asset_id: "test-asset-id",
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      page_url: "https://example.com/page",
      entry_page: "https://example.com/",
      exit_page: null,
      utm_params: {},
      device_info: { browser: "Chrome", os: "macOS", device_type: "Desktop" },
      scroll_depth: 50,
      time_on_page: 30,
      events: [
        {
          type: "page_view",
          data: {
            location: "https://example.com/page",
            title: "Test Page",
            timestamp: 1710000000000,
          },
        },
      ],
    },
    encrypted: false,
    ...overrides,
  };
}
