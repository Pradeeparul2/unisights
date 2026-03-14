# @pradeeparul/unisights-core

Rust-powered WebAssembly core for the Unisights analytics engine. Provides a high-performance `Tracker` with session management, event logging, scroll tracking, web vitals, and time-bucketed rolling key encryption — all compiled to WASM via [`wasm-pack`](https://rustwasm.github.io/wasm-pack/).

[![npm version](https://img.shields.io/npm/v/@pradeeparul2/unisights-core)](https://www.npmjs.com/package/@pradeeparul2/unisights-core)
[![license](https://img.shields.io/npm/l/@pradeeparul2/unisights-core)](./LICENSE)

> **Note:** This package is the low-level WASM core. Most users should use [`@pradeeparul2/unisights`](https://www.npmjs.com/package/@pradeeparul2/unisights) instead, which wraps this package with a browser-friendly API and handles WASM initialization automatically.

---

## Features

- **High-performance event tracking** — written in Rust, compiled to WASM
- **Session management** — tracks asset ID, session ID, UTM params, and device info
- **Event types** — clicks, page views, scroll depth, web vitals, custom events, JS errors
- **Rolling key encryption** — time-bucketed, stateless, server-verifiable with no secrets in the browser
- **Zero JS dependencies** — all logic lives in Rust

---

## Installation

```bash
# npm
npm install @pradeeparul2/unisights-core

# pnpm
pnpm add @pradeeparul2/unisights-core

# yarn
yarn add @pradeeparul2/unisights-core
```

---

## Quick Start

The WASM binary must be initialized before using any exports. Always `await init()` first.

```ts
import init, { Tracker } from "@pradeeparul2/unisights-core";

// 1. Initialize the WASM binary
await init();

// 2. Create a tracker instance
const tracker = new Tracker();

// 3. Set session info
tracker.setSessionInfo(
  "your-asset-id",
  "session-uuid",
  window.location.href,
  { utm_source: "google", utm_medium: "cpc" },
  {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    os: "macOS",
    screenWidth: screen.width,
    screenHeight: screen.height,
    deviceType: "Desktop",
  },
  await sha256(navigator.userAgent), // ua_hash — required for encryption
);

// 4. Log events
tracker.logEntryPage(window.location.href);
tracker.logPageView(window.location.href, document.title);
tracker.logClick(100, 200);
tracker.updateScroll(75.5);

// 5. Export and send the payload
const payload = tracker.exportEncryptedPayload();
await fetch("https://your-backend.com/events", {
  method: "POST",
  body: JSON.stringify(payload),
});

// 6. Clear sent events
tracker.clearEvents();
```

---

## API Reference

### `init(wasmUrl?)`

Initializes the WASM binary. Must be called before creating any `Tracker` instances.

```ts
// Auto-resolve (works in ESM / bundler environments)
await init();

// Explicit URL (required for CDN / IIFE usage)
await init("https://cdn.example.com/unisights_core_bg.wasm");
```

---

### `Tracker`

The main class. Create one instance per page session.

```ts
const tracker = new Tracker();
```

---

#### `tracker.setSessionInfo(assetId, sessionId, pageUrl, utmParams, deviceInfo, uaHash?)`

Attach session metadata. Call once on page load.

```ts
tracker.setSessionInfo(
  "asset-123",
  "session-uuid",
  "https://example.com/page",
  { utm_source: "google", utm_medium: "cpc" },
  {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    os: "macOS",
    screenWidth: 1920,
    screenHeight: 1080,
    deviceType: "Desktop",
  },
  await sha256(navigator.userAgent), // optional, required when encryption is enabled
);
```

| Param        | Type             | Description                                                          |
| ------------ | ---------------- | -------------------------------------------------------------------- |
| `assetId`    | `string`         | Your site/asset identifier                                           |
| `sessionId`  | `string`         | Unique session UUID                                                  |
| `pageUrl`    | `string`         | Current page URL                                                     |
| `utmParams`  | `object \| null` | UTM parameters                                                       |
| `deviceInfo` | `object \| null` | Device/browser metadata                                              |
| `uaHash`     | `string \| null` | SHA256 of `navigator.userAgent` — used for encryption key derivation |

---

#### `tracker.setEncryptionConfig(enable)`

Enable or disable rolling key encryption. When enabled, `ua_hash` must be set via `setSessionInfo`.

```ts
tracker.setEncryptionConfig(true); // enable
tracker.setEncryptionConfig(false); // disable
```

---

#### `tracker.logEntryPage(url)`

Log the first page a user lands on. Call once per session.

```ts
tracker.logEntryPage(window.location.href);
```

---

#### `tracker.logPageView(url, title?)`

Log a page view. Call on every navigation, including SPA route changes.

```ts
tracker.logPageView(window.location.href, document.title);
```

---

#### `tracker.logExitPage(url)`

Log the page the user exits from. Best called on `pagehide`.

```ts
window.addEventListener("pagehide", () => {
  tracker.logExitPage(window.location.href);
});
```

---

#### `tracker.logClick(x, y)`

Log a click with viewport coordinates.

```ts
window.addEventListener("click", (e) => {
  tracker.logClick(e.clientX, e.clientY);
});
```

---

#### `tracker.updateScroll(percent)`

Update the current scroll depth as a percentage (0–100). The tracker keeps the maximum value reached.

```ts
window.addEventListener("scroll", () => {
  const percent =
    ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100;
  tracker.updateScroll(percent);
});
```

---

#### `tracker.logWebVital(name, value, id, rating, delta, entriesCount, navigationType)`

Log a [Core Web Vital](https://web.dev/vitals/) metric.

```ts
import { onLCP } from "web-vitals";

onLCP((metric) => {
  tracker.logWebVital(
    metric.name, // "LCP"
    metric.value, // ms
    metric.id,
    metric.rating, // "good" | "needs-improvement" | "poor"
    metric.delta,
    metric.entries.length,
    metric.navigationType ?? "navigate",
  );
});
```

---

#### `tracker.logCustomEvent(name, data)`

Log a custom named event with a JSON-encoded data string.

```ts
tracker.logCustomEvent(
  "add_to_cart",
  JSON.stringify({ sku: "abc123", qty: 2 }),
);
```

---

#### `tracker.logError(message, source?, lineno?, colno?)`

Log a JavaScript error. Wire up to `window.onerror` or `unhandledrejection`.

```ts
window.addEventListener("error", (e) => {
  tracker.logError(e.message, e.filename, e.lineno, e.colno);
});
```

---

#### `tracker.tick(elapsedSeconds)`

Advance the tracker's internal time-on-page clock. Call on a regular interval.

```ts
let last = performance.now();

setInterval(() => {
  const now = performance.now();
  tracker.tick((now - last) / 1000);
  last = now;
}, 15_000);
```

---

#### `tracker.setPageUrl(url)`

Update the current page URL without logging a page view event.

```ts
tracker.setPageUrl(window.location.href);
```

---

#### `tracker.exportEncryptedPayload()`

Export all pending events as a payload object, encrypted if enabled. Throws if there are no events or session info is incomplete.

```ts
const payload = tracker.exportEncryptedPayload();
navigator.sendBeacon("/collect", JSON.stringify(payload));
```

---

#### `tracker.clearEvents()`

Clear all events from the internal queue after a successful flush.

```ts
const sent = navigator.sendBeacon("/collect", JSON.stringify(payload));
if (sent) tracker.clearEvents();
```

---

#### Getters

```ts
tracker.getScrollDepth(); // → number (max scroll %)
tracker.getTimeOnPage(); // → number (seconds)
tracker.getEventCount(); // → number
tracker.isEncrypted(); // → boolean
tracker.getEntryPage(); // → string | undefined
tracker.getExitPage(); // → string | undefined
tracker.getPageUrl(); // → string | undefined
```

---

## Payload Format

### Unencrypted

```json
{
  "data": {
    "asset_id": "asset-123",
    "session_id": "session-abc",
    "page_url": "https://example.com/page",
    "entry_page": "https://example.com/landing",
    "exit_page": null,
    "utm_params": { "utm_source": "google" },
    "device_info": { "browser": "Chrome" },
    "scroll_depth": 75.5,
    "time_on_page": 42.0,
    "events": [
      {
        "type": "click",
        "data": { "x": 120, "y": 340, "timestamp": 1700000010000 }
      },
      {
        "type": "page_view",
        "data": {
          "location": "https://example.com/about",
          "title": "About Us",
          "timestamp": 1700000015000
        }
      },
      {
        "type": "web_vital",
        "data": {
          "name": "LCP",
          "value": 1200,
          "rating": "good",
          "delta": 1200,
          "id": "v1-abc",
          "entries": 1,
          "navigation_type": "navigate",
          "timestamp": 1700000020000
        }
      },
      {
        "type": "custom",
        "data": {
          "name": "add_to_cart",
          "data": "{\"sku\":\"abc123\"}",
          "timestamp": 1700000025000
        }
      },
      {
        "type": "error",
        "data": {
          "message": "TypeError: null",
          "source": "app.js",
          "lineno": 42,
          "colno": 7,
          "timestamp": 1700000030000
        }
      }
    ]
  },
  "encrypted": false
}
```

### Encrypted

When encryption is enabled, the analytics payload body is encrypted. The envelope contains everything the server needs to verify and decrypt — no server state required.

```json
{
  "data": "<base64 ciphertext>",
  "tag": "<base64 HMAC-SHA256 authentication tag>",
  "bucket": 56666667,
  "site_id": "asset-123",
  "ua_hash": "f9a23b...",
  "encrypted": true
}
```

---

## Encryption

### How it works

The key is derived entirely from public, reproducible inputs. No secret is stored in or transmitted from the browser.

```
bucket     = floor(timestamp_ms / 30_000)       // rotates every 30s
client_key = SHA256(site_id || ":" || bucket || ":" || ua_hash)
ciphertext = plaintext XOR keystream(client_key)
tag        = HMAC-SHA256(client_key, ciphertext)
```

The server receives `site_id`, `ua_hash`, and `bucket` in the payload envelope and independently reproduces `client_key` to verify the tag and decrypt. No session state needed server-side.

For an additional security layer the server can wrap the key:

```
server_key = HMAC(SERVER_SECRET, client_key)
```

### Server-side decryption (Rust)

If your backend is also Rust, you can use this same crate directly:

```rust
use unisights_core::encryption::decrypt;

match decrypt(&ciphertext, &tag, bucket, &site_id, &ua_hash) {
    Ok(plaintext) => {
        let payload: serde_json::Value = serde_json::from_slice(&plaintext)?;
        // process payload
    }
    Err(DecryptError::TagMismatch) => {
        // reject — tampered payload or mismatched inputs
    }
}
```

### Server-side decryption (Python)

```python
import hashlib, hmac as hmac_lib

def decrypt(ciphertext: bytes, tag: bytes, bucket: int, site_id: str, ua_hash: str) -> bytes:
    # Reproduce client_key
    h = hashlib.sha256()
    h.update(site_id.encode())
    h.update(b":")
    h.update(bucket.to_bytes(8, "big"))
    h.update(b":")
    h.update(ua_hash.encode())
    client_key = h.digest()

    # Verify tag before decrypting
    expected_tag = hmac_lib.new(client_key, ciphertext, hashlib.sha256).digest()
    if not hmac_lib.compare_digest(expected_tag, tag):
        raise ValueError("tag mismatch — payload rejected")

    # Decrypt via XOR keystream
    keystream = b""
    chunk = 0
    while len(keystream) < len(ciphertext):
        keystream += hashlib.sha256(client_key + chunk.to_bytes(4, "big")).digest()
        chunk += 1

    return bytes(c ^ k for c, k in zip(ciphertext, keystream))
```

---

## Building from Source

Requires [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/).

```bash
# Install wasm-pack
cargo install wasm-pack

# Build for bundlers (Vite, webpack, Rollup)
wasm-pack build --target bundler

# Build for browsers (script tag / CDN)
wasm-pack build --target web

# Build for Node.js
wasm-pack build --target nodejs
```

Output is written to `pkg/`.

---

## Package Contents

```
pkg/
├── unisights_core.js           # JS bindings
├── unisights_core.d.ts         # TypeScript types
├── unisights_core_bg.wasm      # Compiled WASM binary
├── unisights_core_bg.wasm.d.ts
└── package.json
```

---

## Testing

Tests are split by module and all run under `wasm-pack test`.

```bash
# Run all tests
wasm-pack test --headless --chrome

# Run a specific module
wasm-pack test --headless --chrome --test encryption_tests
wasm-pack test --headless --chrome --test event_tests
wasm-pack test --headless --chrome --test session_tests
wasm-pack test --headless --chrome --test tracker_tests
```

| File                        | Tests   | Coverage                                                              |
| --------------------------- | ------- | --------------------------------------------------------------------- |
| `tests/encryption_tests.rs` | 34      | bucket, key derivation, XOR, HMAC, encrypt, decrypt, tamper rejection |
| `tests/event_tests.rs`      | 16      | EventQueue ops, all 5 event variants                                  |
| `tests/session_tests.rs`    | 15      | defaults, is_ready guards, ua_hash serialization skip                 |
| `tests/tracker_tests.rs`    | 23      | events, scroll, time, clear, build_payload                            |
| `src/lib.rs`                | 41      | full WASM API roundtrip                                               |
| **Total**                   | **129** |                                                                       |

> **ChromeDriver note:** Requires ChromeDriver matching your installed Chrome version. If you see a `status code 404` error, either downgrade ChromeDriver to 114 or upgrade `wasm-bindgen` to `0.2.100+` in `Cargo.toml`.

---

## Dependencies

```toml
[dependencies]
wasm-bindgen       = "0.2"
js-sys             = "0.3"
serde              = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
serde_json         = "1"
base64             = "0.22"
hmac               = "0.12"
sha2               = "0.10"

[dev-dependencies]
wasm-bindgen-test  = "0.3"
```

---

## Related

- [`@pradeeparul/unisights`](https://www.npmjs.com/package/@pradeeparul/unisights) — full browser SDK built on top of this core

---

## License

MIT © Pradeep Arul
