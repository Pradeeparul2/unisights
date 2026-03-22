# Unisights

> Privacy-first, WebAssembly-powered analytics that runs entirely in the browser — no servers required for tracking logic.

[![Known Vulnerabilities](https://snyk.io/test/github/Pradeeparul2/unisights/badge.svg)](https://snyk.io/test/github/Pradeeparul2/unisights)
![CodeQL](https://github.com/Pradeeparul2/unisights/actions/workflows/codeql.yml/badge.svg)
![Dependabot](https://img.shields.io/badge/dependabot-enabled-brightgreen)
[![npm version](https://img.shields.io/npm/v/@pradeeparul2/unisights)](https://www.npmjs.com/package/@pradeeparul2/unisights)
[![license](https://img.shields.io/npm/l/@pradeeparul2/unisights)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dw/@pradeeparul2/unisights)](https://www.npmjs.com/package/@pradeeparul2/unisights)

Unisights is an open-source analytics library built on **Rust + WebAssembly**. All event processing, session management, and optional payload encryption happens inside a WASM binary compiled directly into the bundle — not on a remote server, not in a third-party cloud.

You get full analytics coverage (page views, clicks, scroll, web vitals, errors, rage clicks, engagement time, and more) with a single script tag or npm install, and you own every byte of data that leaves the browser.

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

### CDN (Recommended)

**The easiest way to get started** — no build tools, no npm, no configuration. Just drop this script tag into your HTML `<head>`:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@pradeeparul2/unisights/dist/index.global.js"
  data-insights-id="YOUR_SITE_ID"
  data-endpoint="https://your-api.com/collect"
  data-encrypt="true"
  data-track-page-views="true"
  data-track-clicks="true"
  data-track-scroll="true"
  data-track-errors="true"
  data-track-rage-clicks="true"
  data-track-engagement-time="true"
  async
></script>
```

That's it! The script auto-initializes and starts tracking immediately.

### npm / pnpm / yarn (Advanced)

For bundler-based apps (React, Vue, Next.js):

```bash
# npm
npm install @pradeeparul2/unisights

# pnpm
pnpm add @pradeeparul2/unisights

# yarn
yarn add @pradeeparul2/unisights
```

---

## Usage

### CDN (Auto-init) - Recommended

The script automatically initializes when it detects `data-insights-id` and `data-endpoint` attributes. All configuration is done via data attributes:

#### Required Attributes

| Attribute          | Description                 | Example                          |
| ------------------ | --------------------------- | -------------------------------- |
| `data-insights-id` | Your unique site identifier | `"my-blog"`                      |
| `data-endpoint`    | Endpoint to receive events  | `"https://api.site.com/collect"` |

#### Optional Attributes

| Attribute                    | Default | Description                              |
| ---------------------------- | ------- | ---------------------------------------- |
| `data-encrypt`               | `false` | Enable client-side encryption            |
| `data-debug`                 | `false` | Log events to console                    |
| `data-track-page-views`      | `true`  | Track page views and SPA navigation      |
| `data-track-clicks`          | `true`  | Track click coordinates                  |
| `data-track-scroll`          | `true`  | Track scroll depth                       |
| `data-track-errors`          | `true`  | Track JavaScript errors                  |
| `data-track-rage-clicks`     | `true`  | Track rage click patterns                |
| `data-track-dead-clicks`     | `false` | Track clicks on non-interactive elements |
| `data-track-outbound-links`  | `false` | Track external link clicks               |
| `data-track-file-downloads`  | `false` | Track file download clicks               |
| `data-track-copy-paste`      | `false` | Track copy/paste events                  |
| `data-track-engagement-time` | `true`  | Track actual time on page                |
| `data-track-tab-focus`       | `false` | Track tab focus/blur events              |
| `data-track-network-errors`  | `false` | Track failed network requests            |
| `data-track-long-tasks`      | `false` | Track JS tasks blocking >50ms            |
| `data-track-resource-timing` | `false` | Track slow resource loads                |
| `data-flush-interval-ms`     | `15000` | Flush interval in milliseconds           |

#### Complete Example

```html
<script
  src="https://cdn.jsdelivr.net/npm/@pradeeparul2/unisights/dist/index.global.js"
  data-insights-id="my-blog"
  data-endpoint="https://api.mysite.com/collect"
  data-encrypt="true"
  data-debug="false"
  data-track-page-views="true"
  data-track-clicks="true"
  data-track-scroll="true"
  data-track-errors="true"
  data-track-rage-clicks="true"
  data-track-engagement-time="true"
  data-flush-interval-ms="10000"
  async
></script>
```

#### Disable Auto-init (Manual Mode)

If you need manual control (e.g., GDPR consent, conditional init):

```html
<script
  src="https://cdn.jsdelivr.net/npm/@pradeeparul2/unisights/dist/index.global.js"
  data-no-auto-init="true"
></script>

<script>
  // Initialize manually after user consent
  if (userGaveConsent) {
    window.unisights.init({
      endpoint: "https://api.mysite.com/collect",
      insightsId: "my-blog",
      encrypt: true,
      trackPageViews: true,
      trackClicks: true,
    });
  }
</script>
```

---

### npm (Manual Init)

For React, Vue, Next.js, or any bundler-based setup:

```ts
import { init } from "@pradeeparul2/unisights";

await init({
  endpoint: "https://your-api.com/events",
  insightsId: "your-site-id",
  debug: true,
  encrypt: true,
  trackPageViews: true,
  trackClicks: true,
  trackScroll: true,
  trackErrors: true,
  trackRageClicks: true,
  trackEngagementTime: true,
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
    insightsId: "my-app",
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
      insightsId: "my-nextjs-app",
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

### `window.unisights.init(config)`

Manually initialize the tracker. Required only if using `data-no-auto-init="true"` or npm install.

```ts
await window.unisights.init({
  endpoint: "https://your-api.com/events", // required
  insightsId: "your-site-id", // required
  debug: false,
  encrypt: false,
  flushIntervalMs: 15000,
  trackPageViews: true,
  trackClicks: true,
  trackScroll: true,
  trackRageClicks: true,
  trackErrors: true,
  trackEngagementTime: true,
  // ... all other options from data attributes
});
```

---

### `window.unisights.log(name, data)`

Log a custom event at any time after initialization.

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

When `data-encrypt="true"` or `encrypt: true` is set, the analytics payload is encrypted using a **stateless rolling key** before sending. The envelope contains everything your server needs to verify and decrypt — no server-side session state required.

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

After decryption, your handler receives the standard payload structure with `encrypted: true` flag preserved.

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
import hashlib, hmac as hmac_lib, base64, json

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
    decrypted_data = json.loads(plaintext)

    # Return with encrypted flag preserved
    return {"data": decrypted_data, "encrypted": True}
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

## Why CDN Script Tag is Recommended

1. **Zero Configuration** - Works out of the box, no build tools needed
2. **Non-Technical Friendly** - Marketing teams can install without developer help
3. **Fewer Integration Bugs** - No manual init code to write
4. **Faster Deployment** - Copy-paste solution for 95% of use cases
5. **Industry Standard** - Same pattern as Google Analytics, Plausible, Mixpanel

Use manual npm install only for:

- Complex GDPR consent flows requiring conditional initialization
- A/B testing different tracking configurations
- Framework-specific integrations (React hooks, Vue plugins)

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
