/**
 * decrypt.ts
 *
 * Server-side decryption for unisights encrypted payloads.
 *
 * Algorithm (mirrors the Rust/WASM core exactly):
 *   client_key = SHA256(site_id + ":" + bucket_as_8_bytes_big_endian + ":" + ua_hash)
 *   keystream   = SHA256(client_key || chunk_0) || SHA256(client_key || chunk_1) || ...
 *   plaintext   = ciphertext XOR keystream
 *   tag         = HMAC-SHA256(client_key, ciphertext)  ← verified before decrypt
 *
 * Optional server-side key wrapping:
 *   server_key  = HMAC-SHA256(SERVER_SECRET, client_key)
 *
 * Uses only the Web Crypto API (SubtleCrypto) — Node 18+, CF Workers, Deno, Bun,
 * Vercel Edge, Netlify Edge. No `node:crypto` import needed.
 */

import type {
  EncryptedPayload,
  UnisightsPayload,
  DecryptOptions,
} from "./types.js";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Type guard — narrows an unknown payload to `EncryptedPayload`.
 */
export function isEncrypted(payload: unknown): payload is EncryptedPayload {
  return (
    payload !== null &&
    typeof payload === "object" &&
    (payload as EncryptedPayload).encrypted === true &&
    typeof (payload as EncryptedPayload).data === "string" &&
    typeof (payload as EncryptedPayload).tag === "string" &&
    typeof (payload as EncryptedPayload).bucket === "number" &&
    typeof (payload as EncryptedPayload).site_id === "string" &&
    typeof (payload as EncryptedPayload).ua_hash === "string"
  );
}

/**
 * Decrypt an encrypted unisights payload.
 * Throws `DecryptError` if the HMAC tag does not match.
 *
 * @example
 * const collector = unisights({
 *   path: '/collect',
 *   handler: async (raw) => {
 *     const payload = isEncrypted(raw)
 *       ? await decrypt(raw)
 *       : raw as UnisightsPayload
 *     await db.insert(payload.data)
 *   }
 * })
 *
 * // With optional server secret:
 * const payload = await decrypt(raw, { serverSecret: process.env.UNISIGHTS_SECRET })
 */
export async function decrypt(
  payload: EncryptedPayload,
  options: DecryptOptions = {},
): Promise<UnisightsPayload> {
  const { data: b64Cipher, tag: b64Tag, bucket, site_id, ua_hash } = payload;

  const ciphertext = base64Decode(b64Cipher);
  const receivedTag = base64Decode(b64Tag);

  // Reproduce client_key from public inputs
  let key = await deriveClientKey(site_id, bucket, ua_hash);

  // Optional server-side wrapping: server_key = HMAC-SHA256(SERVER_SECRET, client_key)
  if (options.serverSecret) {
    key = await wrapWithServerSecret(options.serverSecret, key);
  }

  // Verify tag BEFORE decrypting (authenticate-then-decrypt)
  await verifyTag(key, ciphertext, receivedTag);

  // Decrypt via XOR keystream
  const plaintext = await xorDecrypt(key, ciphertext);

  const text = new TextDecoder().decode(plaintext);
  try {
    const decryptedData = JSON.parse(text);
    // Return nested structure matching Python backend
    return {
      data: decryptedData,
      encrypted: true,
    } as UnisightsPayload;
  } catch {
    throw new DecryptError("Decrypted payload is not valid JSON");
  }
}

export class DecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptError";
  }
}

// ── Byte helpers (must be defined before use) ─────────────────────────────────

/** Slice a Uint8Array into a plain ArrayBuffer — required for SubtleCrypto under strict TS */
function ab(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength,
  ) as ArrayBuffer;
}

/** Encode a JS number as 8-byte big-endian (safe for integers up to 2^53) */
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

/** Concatenate multiple Uint8Arrays into one */
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

/** Decode a base64 string to Uint8Array */
function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Key derivation ────────────────────────────────────────────────────────────

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

// ── Tag verification ──────────────────────────────────────────────────────────

async function verifyTag(
  key: Uint8Array,
  ciphertext: Uint8Array,
  receivedTag: Uint8Array,
): Promise<void> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    ab(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    hmacKey,
    ab(receivedTag),
    ab(ciphertext),
  );
  if (!valid)
    throw new DecryptError(
      "Tag mismatch — payload rejected (tampered or wrong inputs)",
    );
}

// ── XOR decryption ────────────────────────────────────────────────────────────

async function xorDecrypt(
  key: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const chunks = Math.ceil(ciphertext.length / 32);
  const keystream = new Uint8Array(chunks * 32);

  for (let chunk = 0; chunk < chunks; chunk++) {
    // 4-byte big-endian counter — matches Rust u32::to_be_bytes
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

  const plaintext = new Uint8Array(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++)
    plaintext[i] = ciphertext[i] ^ keystream[i];
  return plaintext;
}
