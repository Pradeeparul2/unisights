# Unisights

> Privacy-first, WebAssembly-powered analytics that runs entirely in the browser — no servers required for tracking logic.

Unisights is an open-source analytics library built on **Rust + WebAssembly**. All event processing, session management, and optional payload encryption happens inside a WASM binary compiled directly into the bundle — not on a remote server, not in a third-party cloud.

You get full analytics coverage (page views, clicks, scroll, web vitals, errors, rage clicks, engagement time, and more) with a single script tag or npm install, and you own every byte of data that leaves the browser.

[![Known Vulnerabilities](https://snyk.io/test/github/Pradeeparul2/unisights/badge.svg)](https://snyk.io/test/github/Pradeeparul2/unisights)
![CodeQL](https://github.com/Pradeeparul2/unisights/actions/workflows/codeql.yml/badge.svg)
![Dependabot](https://img.shields.io/badge/dependabot-enabled-brightgreen)
[![npm version](https://img.shields.io/npm/v/@pradeeparul2/unisights)](https://www.npmjs.com/package/@pradeeparul2/unisights)
[![license](https://img.shields.io/npm/l/@pradeeparul2/unisights)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dw/@pradeeparul2/unisights)](https://www.npmjs.com/package/@pradeeparul2/unisights)

---

## Core Idea

Most analytics tools work like this:

```
Browser → Third-party SDK → Their servers → Your dashboard
```

Unisights works like this:

```
Browser → WASM core (your bundle) → Your endpoint → Your database
```

The tracking logic — session handling, event buffering, encryption, payload serialization — runs in a Rust-compiled WASM module embedded in the JS bundle. There are no external fetches to analytics infrastructure. Your endpoint receives structured JSON payloads via `navigator.sendBeacon`, and you decide what to store, aggregate, and display.

---

## How It's Different

Most open-source analytics libraries are simple pixel trackers —
they count page views and send raw data to your server.
Unisights is the only one with a WASM core and client-side encryption.

| Feature                     | Unisights | Plausible | Umami | analytics.js | Fathom |
| --------------------------- | --------- | --------- | ----- | ------------ | ------ |
| WASM core                   | ✅        | ❌        | ❌    | ❌           | ❌     |
| Client-side encryption      | ✅        | ❌        | ❌    | ❌           | ❌     |
| No secret stored in browser | ✅        | ✅        | ✅    | ✅           | ✅     |
| Web Vitals built-in         | ✅        | ❌        | ❌    | ❌           | ❌     |
| SPA navigation              | ✅        | ✅        | ✅    | ✅           | ❌     |
| Session tracking            | ✅        | ❌        | ❌    | ❌           | ❌     |
| Scroll depth                | ✅        | ❌        | ❌    | ❌           | ❌     |
| Click coordinates           | ✅        | ❌        | ❌    | ❌           | ❌     |
| Rage click detection        | ✅        | ❌        | ❌    | ❌           | ❌     |
| Custom events               | ✅        | ✅        | ✅    | ✅           | ✅     |
| No cookies                  | ✅        | ✅        | ✅    | ✅           | ✅     |
| Self-hostable               | ✅        | ✅        | ✅    | ✅           | ✅     |
| Bundle size (gzip)          | ~86KB     | ~1KB      | ~8KB  | ~3KB         | ~2KB   |

**The tradeoff is honest** — Plausible and Umami are far smaller
because they do far less in the browser. Unisights trades bundle
size for richer data collection and client-side security guarantees.

---

## Installation

### npm / pnpm / yarn

```bash
# npm
npm install @pradeeparul2/unisights

# pnpm
pnpm add @pradeeparul2/unisights

# yarn
yarn add @pradeeparul2/unisights
```

### Packages

| Package                        | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `@pradeeparul2/unisights`      | Main analytics library                        |
| `@pradeeparul2/unisights-core` | Rust/WASM core (auto-installed as dependency) |

---

## Usage

### CDN (Script Tag)

The simplest way — no build tools required. Drop this into your HTML `<head>`:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@pradeeparul2/unisights/dist/index.global.js"
  data-insights-id="YOUR_INSIGHTS_ID"
  async
></script>
```

With encryption enabled:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@pradeeparul2/unisights/dist/index.global.js"
  data-insights-id="YOUR_INSIGHTS_ID"
  async
></script>
```

Pre-init queue — safe to call before the script loads:

```html
<script>
  window.unisightsq = window.unisightsq || [];
  window.unisightsq.push(() => {
    window.unisights.log("app_loaded", { version: "1.0.0" });
  });
</script>
```

---

### npm (ESM)

```ts
import { init } from "@pradeeparul2/unisights";

await init({
  endpoint: "https://your-api.com/events",
  debug: true,
  trackPageViews: true,
  trackClicks: true,
  trackScroll: true,
  trackErrors: true,
});
```

---

### React

```tsx
// analytics.ts
import { init } from "@pradeeparul2/unisights";

let initialized = false;

export async function initAnalytics() {
  if (initialized) return;
  initialized = true;
  await init({
    endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT!,
    trackPageViews: true,
    trackClicks: true,
    trackRageClicks: true,
    trackErrors: true,
  });
}
```

```tsx
// app/layout.tsx or _app.tsx
import { useEffect } from "react";
import { initAnalytics } from "./analytics";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return <Component {...pageProps} />;
}
```

---

### Next.js

Unisights handles SPA navigation automatically via `pushState`/`popstate` interception — no additional router integration needed.

```tsx
// app/layout.tsx (App Router)
"use client";

import { useEffect } from "react";
import { init } from "@pradeeparul2/unisights";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    init({
      endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT!,
      trackPageViews: true,
      trackClicks: true,
      trackScroll: true,
      trackErrors: true,
      trackRageClicks: true,
      trackEngagementTime: true,
    });
  }, []);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

Add WASM support to `next.config.js`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

module.exports = nextConfig;
```

---

## API Reference

### `init(config?)`

Initializes the tracker. Must be called once. Subsequent calls are no-ops.

```ts
await init({
  endpoint: "https://your-api.com/events", // required — where payloads are sent
  debug: false, // logs events to console
  encrypt: false, // enables rolling key encryption
  flushIntervalMs: 15000, // how often to flush (ms)

  // Page
  trackPageViews: true, // entry page + page views + SPA navigation

  // Interactions
  trackClicks: true, // x/y coordinates of every click
  trackScroll: true, // scroll depth percentage
  trackRageClicks: true, // 3+ rapid clicks in same area
  trackDeadClicks: true, // clicks on non-interactive elements
  trackOutboundLinks: true, // clicks on external links
  trackFileDownloads: true, // clicks on pdf/zip/docx/xlsx etc
  trackCopyPaste: false, // copy and paste events

  // Errors
  trackErrors: true, // window.onerror + unhandledrejection

  // Engagement
  trackEngagementTime: true, // actual active time on page
  trackTabFocus: true, // tab focus / blur events

  // Performance (opt-in)
  trackNetworkErrors: false, // failed fetch requests
  trackLongTasks: false, // JS tasks blocking >50ms
  trackResourceTiming: false, // resources taking >1s to load
});
```

---

### `window.unisights.log(name, data)`

Log a custom event at any time after `init()`.

```ts
window.unisights.log("purchase", {
  productId: "prod_123",
  amount: 49.99,
  currency: "USD",
});

window.unisights.log("signup_completed", { plan: "pro" });
```

---

### `window.unisights.flushNow()`

Immediately send all buffered events to your endpoint. Useful before critical navigation.

```ts
window.unisights.flushNow();
```

---

### `window.unisights.registerEvent(eventType, handler)`

Attach a custom DOM event listener and log the result as a custom event.

```ts
const logFormSubmit = window.unisights.registerEvent("submit", (e) => e);

// Later, inside your form submit handler:
logFormSubmit("form_submit", { formId: "contact" });
```

---

### Script Tag Attributes

| Attribute          | Required | Description                    |
| ------------------ | -------- | ------------------------------ |
| `data-insights-id` | ✅       | Your unique project identifier |

---

## Payload Format

Unisights sends JSON to your endpoint via `navigator.sendBeacon`. All field names are **snake_case**.

### Unencrypted

```json
{
  "data": {
    "asset_id": "YOUR_INSIGHTS_ID",
    "session_id": "uuid-v4",
    "page_url": "https://yoursite.com/page",
    "entry_page": "https://yoursite.com/landing",
    "exit_page": null,
    "utm_params": { "utm_source": "google", "utm_medium": "cpc" },
    "device_info": {
      "browser": "Chrome",
      "os": "macOS",
      "device_type": "Desktop"
    },
    "scroll_depth": 75.5,
    "time_on_page": 42.0,
    "events": [
      {
        "type": "page_view",
        "data": {
          "location": "https://yoursite.com/page",
          "title": "Page Title",
          "timestamp": 1710000000000
        }
      },
      {
        "type": "click",
        "data": { "x": 340, "y": 210, "timestamp": 1710000005000 }
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
          "timestamp": 1710000010000
        }
      },
      {
        "type": "custom",
        "data": {
          "name": "purchase",
          "data": "{\"amount\":49.99}",
          "timestamp": 1710000015000
        }
      },
      {
        "type": "error",
        "data": {
          "message": "TypeError: null",
          "source": "app.js",
          "lineno": 42,
          "colno": 7,
          "timestamp": 1710000020000
        }
      }
    ]
  },
  "encrypted": false
}
```

### Encrypted

When `encrypt: true` is set, the analytics payload is encrypted using a **stateless rolling key** before sending. The envelope contains everything your server needs to verify and decrypt — no server-side session state required.

```json
{
  "data": "<base64 ciphertext>",
  "tag": "<base64 HMAC-SHA256 authentication tag>",
  "bucket": 56666667,
  "site_id": "YOUR_INSIGHTS_ID",
  "ua_hash": "f9a23b...",
  "encrypted": true
}
```

---

## Encryption

### How it works

The encryption key is derived entirely from public, reproducible inputs. **No secret is stored in or transmitted from the browser.**

```
bucket     = floor(timestamp_ms / 30_000)        // rotates every 30 seconds
client_key = SHA256(site_id || ":" || bucket || ":" || ua_hash)
ciphertext = plaintext XOR keystream(client_key)
tag        = HMAC-SHA256(client_key, ciphertext)
```

`ua_hash` is a SHA256 hash of `navigator.userAgent`, computed by the SDK automatically. The server receives `site_id`, `ua_hash`, and `bucket` in the envelope and can independently reproduce `client_key` to verify the tag and decrypt — statelessly, with no stored keys.

For an additional security layer, the server can wrap the key:

```
server_key = HMAC(SERVER_SECRET, client_key)
```

### Server-side decryption (Python)

```python
import hashlib, hmac as hmac_lib, base64

def decrypt_payload(payload: dict) -> dict:
    ciphertext = base64.b64decode(payload["data"])
    tag        = base64.b64decode(payload["tag"])
    bucket     = payload["bucket"]
    site_id    = payload["site_id"]
    ua_hash    = payload["ua_hash"]

    # Reproduce client_key from public inputs
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
    keystream, chunk = b"", 0
    while len(keystream) < len(ciphertext):
        keystream += hashlib.sha256(client_key + chunk.to_bytes(4, "big")).digest()
        chunk += 1

    plaintext = bytes(c ^ k for c, k in zip(ciphertext, keystream))
    return json.loads(plaintext)
```

### Server-side decryption (Rust)

If your backend is Rust, use the core crate directly:

```rust
use unisights_core::encryption::decrypt;

match decrypt(&ciphertext, &tag, bucket, &site_id, &ua_hash) {
    Ok(plaintext) => {
        let payload: serde_json::Value = serde_json::from_slice(&plaintext)?;
    }
    Err(DecryptError::TagMismatch) => {
        // reject — tampered payload or mismatched inputs
    }
}
```

---

## License

MIT License

Copyright (c) 2024 Pradeep Arul

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
