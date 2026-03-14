# Unisights

> Privacy-first, WebAssembly-powered analytics that runs entirely in the browser — no servers required for tracking logic.

---

## What is Unisights?

Unisights is an open-source analytics library built on **Rust + WebAssembly**. All event processing, session management, and optional payload encryption happens inside a WASM binary compiled directly into the bundle — not on a remote server, not in a third-party cloud.

You get full analytics coverage (page views, clicks, scroll, web vitals, errors, rage clicks, engagement time, and more) with a single script tag or npm install, and you own every byte of data that leaves the browser.

---

## Monorepo Structure

```
unisights/
├── packages/
│   ├── core/                        # Rust/WASM core
│   │   ├── src/
│   │   │   └── lib.rs               # Tracker, event types, rolling key encryption
│   │   ├── tests/
│   │   │   ├── encryption_tests.rs  # 34 tests — bucket, key derivation, XOR, HMAC
│   │   │   ├── event_tests.rs       # 16 tests — EventQueue, all event variants
│   │   │   ├── session_tests.rs     # 15 tests — defaults, guards, ua_hash
│   │   │   └── tracker_tests.rs     # 23 tests — events, scroll, time, flush
│   │   ├── Cargo.toml
│   │   ├── Cargo.lock
│   │   └── webdriver.json
│   ├── unisights/                   # TypeScript SDK
│   │   ├── src/                     # TypeScript source
│   │   ├── tests/                   # SDK tests
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   └── node/              # Node.js server receiver
│       ├── src/
│       │   ├── adapters/            # Express, Fastify, Koa, Hono, Elysia, Fetch
│       │   ├── index.ts             # Main entry — unisights() factory
│       │   ├── parseBody.ts         # Runtime-agnostic body parser
│       │   └── types.ts             # Full payload types + UnisightsPayload
│       ├── package.json
│       ├── tsconfig.json
│       └── tsconfig.build.json
├── .gitignore
├── LICENSE
├── package.json                     # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

### Packages

| Package                                                     | Description                                                                      | Docs                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`@pradeeparul2/unisights`](./packages/unisights)           | Browser library — auto-tracking, public API, script tag support                  | [README →](./packages/unisights/README.md)      |
| [`@pradeeparul2/unisights-core`](./packages/core)           | Rust/WASM core — event tracking, session management, rolling key encryption      | [README →](./packages/core/README.md)           |
| [`@pradeeparul2/unisights-node`](./packages/unisights-node) | Node.js server receiver — exposes a POST endpoint, receives payloads, always 200 | [README →](./packages/unisights-node/README.md) |

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

`unisights-node` is the server-side counterpart: a zero-dependency, framework-agnostic package that creates that endpoint for you.

---

## How It's Different

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
| Error tracking              | ✅        | ❌        | ❌    | ❌           | ❌     |
| Engagement time             | ✅        | ❌        | ❌    | ❌           | ❌     |
| Outbound link tracking      | ✅        | ✅        | ❌    | ❌           | ❌     |
| Custom events               | ✅        | ✅        | ✅    | ✅           | ✅     |
| No cookies                  | ✅        | ✅        | ✅    | ✅           | ✅     |
| Self-hostable               | ✅        | ✅        | ✅    | ✅           | ✅     |
| Server receiver package     | ✅        | ❌        | ❌    | ❌           | ❌     |
| Bundle size (gzip)          | ~86KB     | ~1KB      | ~8KB  | ~3KB         | ~2KB   |

**The tradeoff is honest** — Plausible and Umami are far smaller because they do far less in the browser. Unisights trades bundle size for richer data collection and client-side security guarantees.

---

## Quick Start

### Browser — CDN

Drop this into your HTML `<head>` — no build tools required:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@pradeeparul2/unisights/dist/index.global.js"
  data-insights-id="YOUR_INSIGHTS_ID"
  async
></script>

<script>
  window.unisights.init({
    endpoint: "https://your-api.com/collect",
  });
</script>
```

### Browser — npm / pnpm / yarn

```bash
npm install @pradeeparul2/unisights
```

```ts
import { init } from "@pradeeparul2/unisights";

await init({
  endpoint: "https://your-api.com/collect",
  trackPageViews: true,
  trackClicks: true,
  trackErrors: true,
  trackRageClicks: true,
  trackEngagementTime: true,
});
```

### Server — receive events

Install the server receiver in your backend:

```bash
npm install @pradeeparul2/unisights-node
```

Wire it up with one line — works on every Node.js framework and cloud edge runtime:

```ts
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    // payload is fully typed as UnisightsPayload
    await db.events.insert(payload.data);
  },
});

// Express / NestJS
app.use(collector);

// Fastify
fastify.register(collector.fastify);

// Koa
app.use(collector.koa);

// Cloudflare Workers / Deno / Bun / Vercel Edge / Netlify Edge
export default { fetch: collector.fetch };

// Hono
app.use("*", collector.hono);

// Elysia (Bun)
collector.elysia(app);
```

The endpoint **always returns 200** — the browser's `sendBeacon` call never blocks or retries.

See [`packages/unisights-node/README.md`](./packages/unisights-node/README.md) for the full framework guide, payload types, and TypeScript usage.

---

## Payload Shape

Every POST to your endpoint carries a structured `UnisightsPayload`:

```ts
interface UnisightsPayload {
  data: {
    asset_id: string; // your Unisights property ID
    session_id: string; // UUID v4
    page_url: string;
    entry_page: string;
    exit_page: string | null;
    utm_params: UtmParams;
    device_info: DeviceInfo;
    scroll_depth: number; // 0–100
    time_on_page: number; // seconds
    events: UnisightsEvent[]; // discriminated union (see below)
  };
  encrypted: boolean;
}
```

Events are a discriminated union — TypeScript narrows the `data` shape automatically per `type`:

```ts
type UnisightsEvent =
  | { type: "page_view"; data: PageViewEventData }
  | { type: "click"; data: ClickEventData }
  | { type: "web_vital"; data: WebVitalEventData }
  | { type: "custom"; data: CustomEventData }
  | { type: "error"; data: ErrorEventData };
```

All types are exported from `@pradeeparul2/unisights-node`.

---

## Encryption

The key is derived entirely from public, reproducible inputs. **No secret is stored in or transmitted from the browser.**

```
bucket     = floor(timestamp_ms / 30_000)        // rotates every 30 seconds
client_key = SHA256(site_id || ":" || bucket || ":" || ua_hash)
ciphertext = plaintext XOR keystream(client_key)
tag        = HMAC-SHA256(client_key, ciphertext)
```

The server receives `site_id`, `ua_hash`, and `bucket` in the payload envelope and independently reproduces `client_key` to verify the tag and decrypt — no session state needed server-side.

Enable it with a single flag:

```ts
await init({
  endpoint: "https://your-api.com/collect",
  encrypt: true,
});
```

Encrypted payload envelope:

```json
{
  "data": "<base64 ciphertext>",
  "tag": "<base64 HMAC-SHA256 tag>",
  "bucket": 56666667,
  "site_id": "YOUR_INSIGHTS_ID",
  "ua_hash": "f9a23b...",
  "encrypted": true
}
```

See [`packages/core/README.md`](./packages/core/README.md) for server-side decryption examples in Python and Rust.

---

## Development

### Prerequisites

- Node.js >= 18
- Rust + Cargo — `curl https://sh.rustup.rs -sSf | sh`
- wasm-pack — `cargo install wasm-pack`
- pnpm — `npm install -g pnpm`

### Setup

```bash
git clone https://github.com/Pradeeparul2/unisights.git
cd unisights
pnpm install
```

### Build

```bash
# Build everything from workspace root
pnpm -r build

# Build packages individually
cd packages/core           && wasm-pack build --target web --release
cd packages/unisights      && pnpm build
cd packages/unisights-node && pnpm build
```

### Test

```bash
# Rust core (129 tests, requires ChromeDriver)
cd packages/core
wasm-pack test --chrome

# TypeScript SDK
cd packages/unisights
pnpm test

# Node server receiver
cd packages/unisights-node
pnpm test
```

### CI / CD

Releases publish automatically to npm on push to `main`:

1. Restores caches — Rust registry, build artifacts, wasm-pack binary, pnpm store
2. Builds WASM with `wasm-pack build --target web --release`
3. Bundles JS with tsup — WASM binary inlined, no separate `.wasm` file needed
4. Generates `.d.ts` declarations
5. Publishes all three packages to npm via `pnpm publish`

Bump versions in `packages/core/package.json`, `packages/unisights/package.json`, and `packages/unisights-node/package.json` before merging to trigger a release.

---

## Roadmap

- [ ] ECDH key exchange — proper forward secrecy
- [ ] `@pradeeparul/unisights-react` — React hooks package
- [ ] `@pradeeparul/unisights-vue` — Vue plugin
- [ ] Dashboard UI
- [ ] Session replay
- [ ] User identity — `identify()` API
- [ ] Feature flags + A/B testing

---

## Contributing

PRs are welcome. Please open an issue first for significant changes.

---

## License

MIT © Pradeep Arul
