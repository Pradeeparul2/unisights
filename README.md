# Unisights

> Privacy-first, WebAssembly-powered analytics that runs entirely in the browser — no servers required for tracking logic.

---

## What is Unisights?

Unisights is an open-source analytics library built on **Rust + WebAssembly**. All event processing, session management, and optional payload encryption happens inside a WASM binary compiled directly into the bundle — not on a remote server, not in a third-party cloud.

You get full analytics coverage (page views, clicks, scroll, web vitals, errors, rage clicks, engagement time, and more) with a single script tag or npm install, and you own every byte of data that leaves the browser.

**Backend receivers are available for Node.js and Python**, enabling seamless integration with your existing infrastructure — Express, FastAPI, Flask, Django, Fastify, Hono, and more.

---

## Monorepo Structure

```
unisights/
├── packages/
│   ├── core/                        # Rust/WASM core
│   │   ├── src/
│   │   │   └── lib.rs               # Tracker, event types, rolling key encryption
│   │   ├── tests/
│   │   │   ├── encryption_tests.rs
│   │   │   ├── event_tests.rs
│   │   │   ├── session_tests.rs
│   │   │   └── tracker_tests.rs
│   │   ├── Cargo.toml
│   │   ├── Cargo.lock
│   │   └── webdriver.json
│   │
│   ├── unisights/                   # TypeScript browser SDK
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── vitest.config.ts
│   │
│   ├── node/                        # Node.js server receiver
│   │   ├── src/
│   │   │   ├── adapters/            # Express, Fastify, Koa, Hono, Elysia, Fetch
│   │   │   ├── index.ts             # Main entry — unisights() factory
│   │   │   ├── parseBody.ts
│   │   │   └── types.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   │
│   └── python/                      # Python server receiver
│       ├── src/
│       │   └── unisights/
│       │       ├── __init__.py
│       │       ├── types.py         # Type definitions (matching Node.js)
│       │       ├── validator.py     # Comprehensive validation engine
│       │       ├── collector.py     # Core payload processor
│       │       ├── config.py        # Configuration
│       │       ├── fastapi.py       # FastAPI integration
│       │       ├── flask.py         # Flask integration
│       │       ├── django.py        # Django integration
│       │       └── asgi.py          # Generic ASGI middleware
│       ├── tests/
│       │   └── test_validator.py    # 50+ test cases
│       ├── examples/
│       │   ├── fastapi_example.py
│       │   ├── flask_example.py
│       │   └── django_example.py
│       ├── pyproject.toml
│       ├── README.md
│       └── README_UPDATED.md
│
├── .gitignore
├── LICENSE
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

### Packages

| Package                                           | Description                                                                                 | Supported                                                     | Docs                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| [`@pradeeparul2/unisights`](./packages/unisights) | **Browser SDK** — auto-tracking, public API, script tag support, Web Vitals, error tracking | ✅ All browsers                                               | [README →](./packages/unisights/README.md) |
| [`@pradeeparul2/unisights-core`](./packages/core) | **Rust/WASM core** — event tracking, session management, rolling key encryption             | ✅ Web, Node.js                                               | [README →](./packages/core/README.md)      |
| [`@pradeeparul2/unisights-node`](./packages/node) | **Node.js receiver** — POST endpoint, fully typed payloads, 0 dependencies                  | Express, NestJS, Fastify, Koa, Hono, Elysia, Fetch API (edge) | [README →](./packages/node/README.md)      |
| [`unisights` (Python)](./packages/python)         | **Python receiver** — POST endpoint, type-safe validation, background queue support         | FastAPI, Flask, Django, ASGI                                  | [README →](./packages/python/README.md)    |

---

## Core Idea

Most analytics tools work like this:

```
Browser → Third-party SDK → Their servers → Your dashboard
```

Unisights works like this:

```
Browser (WASM) → Your endpoint (Node.js or Python) → Your database
```

The tracking logic — session handling, event buffering, encryption, payload serialization — runs in a Rust-compiled WASM module embedded in the JS bundle. There are no external fetches to analytics infrastructure. Your endpoint receives structured JSON payloads via `navigator.sendBeacon`, and you decide what to store, aggregate, and display.

Server receivers (`unisights-node` and `unisights-python`) are the backend counterpart: zero-dependency packages that create that endpoint for you in your preferred backend language.

---

## Architecture

```scss
Browser (WASM analytics)
        │
        ├─ auto-tracking (page views, clicks, scroll, vitals, errors)
        ├─ session management (UUID, time-on-page, scroll depth)
        ├─ optional encryption (rolling-key, client-side)
        │
        ▼
navigator.sendBeacon()
        │
        ▼
Your Endpoint
   ├── Node.js      → @pradeeparul2/unisights-node
   │   ├── Express, NestJS, Fastify, Koa
   │   └── Edge (Vercel, Netlify, Cloudflare Workers, Deno, Bun)
   │
   └── Python       → unisights (PyPI)
       ├── FastAPI (async-first)
       ├── Flask (with background queue)
       └── Django (sync & async views)
        │
        ▼
Your Storage
   ├── Database (PostgreSQL, MongoDB, etc.)
   ├── Data warehouse (BigQuery, Snowflake, etc.)
   ├── Message queue (Kafka, Redis, etc.)
   └── Custom pipeline
```

The browser never sends analytics to third-party infrastructure — all events flow directly to your backend.

---

## Features Comparison

| Feature                                    | Unisights | Plausible | Umami | analytics.js | Fathom |
| ------------------------------------------ | --------- | --------- | ----- | ------------ | ------ |
| **Tracking**                               |
| WASM core                                  | ✅        | ❌        | ❌    | ❌           | ❌     |
| Page views                                 | ✅        | ✅        | ✅    | ✅           | ✅     |
| Click tracking + coordinates               | ✅        | ❌        | ❌    | ❌           | ❌     |
| Scroll depth                               | ✅        | ❌        | ❌    | ❌           | ❌     |
| Web Vitals (FCP, LCP, CLS, INP, TTFB, FID) | ✅        | ❌        | ❌    | ❌           | ❌     |
| Error tracking                             | ✅        | ❌        | ❌    | ❌           | ❌     |
| Rage click detection                       | ✅        | ❌        | ❌    | ❌           | ❌     |
| Engagement time                            | ✅        | ❌        | ❌    | ❌           | ❌     |
| Session tracking                           | ✅        | ❌        | ❌    | ❌           | ❌     |
| SPA navigation                             | ✅        | ✅        | ✅    | ✅           | ❌     |
| Outbound link tracking                     | ✅        | ✅        | ❌    | ❌           | ❌     |
| Custom events                              | ✅        | ✅        | ✅    | ✅           | ✅     |
| **Privacy & Security**                     |
| Client-side encryption                     | ✅        | ❌        | ❌    | ❌           | ❌     |
| No secret in browser                       | ✅        | ✅        | ✅    | ✅           | ✅     |
| No cookies                                 | ✅        | ✅        | ✅    | ✅           | ✅     |
| **Backend**                                |
| Node.js receiver                           | ✅        | ❌        | ❌    | ❌           | ❌     |
| Python receiver                            | ✅        | ❌        | ❌    | ❌           | ❌     |
| Self-hostable                              | ✅        | ✅        | ✅    | ✅           | ✅     |
| **Bundle Size**                            | ~86KB     | ~1KB      | ~8KB  | ~3KB         | ~2KB   |

**The tradeoff is honest** — Plausible and Umami are far smaller because they do far less in the browser. Unisights trades bundle size for richer data collection, client-side security guarantees, and dual backend support (Node.js + Python).

---

## Quick Start

### Browser — CDN (30 seconds)

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
  encrypt: true, // optional
});
```

### Server — Node.js Receiver (1 minute)

Install and wire up with one line:

```bash
npm install @pradeeparul2/unisights-node
```

```ts
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    // payload is fully typed as UnisightsPayload
    await db.events.insert(payload.data);
  },
});

// Works on every Node.js framework & cloud edge runtime
app.use(collector); // Express / NestJS
fastify.register(collector.fastify); // Fastify
app.use(collector.koa); // Koa
app.use("*", collector.hono); // Hono
export default { fetch: collector.fetch }; // Edge (Cloudflare, Vercel, Netlify)
collector.elysia(app); // Elysia (Bun)
```

### Server — Python Receiver (1 minute)

Install and wire up with one line:

```bash
pip install unisights
```

```python
from fastapi import FastAPI
from unisights.fastapi import unisights_fastapi
from unisights import UnisightsOptions

app = FastAPI()

async def handler(payload, request):
    # payload is fully typed UnisightsPayload
    await db.events.insert_one(payload.data.to_dict())

options = UnisightsOptions(handler=handler)
app.include_router(unisights_fastapi(options))
```

**Flask:**

```python
from flask import Flask
from unisights.flask import unisights_flask

app = Flask(__name__)
app.register_blueprint(unisights_flask(UnisightsOptions(handler=handler)))
```

**Django:**

```python
from django.urls import path
from unisights.django import unisights_django

urlpatterns = [
    path("collect/", unisights_django(UnisightsOptions(handler=handler)))
]
```

The endpoint **always returns 200** — the browser's `sendBeacon` call never blocks or retries.

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
    utm_params: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_term?: string;
      utm_content?: string;
    };
    device_info: {
      browser: string; // e.g., "Chrome"
      os: string; // e.g., "Windows"
      device_type: string; // "Desktop" | "Mobile" | "Tablet"
    };
    scroll_depth: number; // 0–100 (percentage)
    time_on_page: number; // seconds
    events: UnisightsEvent[]; // discriminated union
  };
  encrypted: boolean;
}
```

Events are a **discriminated union** — TypeScript automatically narrows the `data` type per `event.type`:

```ts
type UnisightsEvent =
  | {
      type: "page_view";
      data: { location: string; title: string; timestamp: number };
    }
  | { type: "click"; data: { x: number; y: number; timestamp: number } }
  | {
      type: "web_vital";
      data: {
        name: "FCP" | "LCP" | "CLS" | "INP" | "TTFB" | "FID";
        value: number;
        rating: "good" | "needs-improvement" | "poor";
        delta: number;
        id: string;
        entries: number;
        navigation_type: string;
        timestamp: number;
      };
    }
  | { type: "custom"; data: { name: string; data: string; timestamp: number } }
  | {
      type: "error";
      data: {
        message: string;
        source: string;
        lineno: number;
        colno: number;
        timestamp: number;
      };
    };
```

All types are **exported** from both `@pradeeparul2/unisights-node` (TypeScript) and `unisights` (Python).

---

## Encryption

The key is derived entirely from public, reproducible inputs. **No secret is stored in or transmitted from the browser.**

```
bucket     = floor(timestamp_ms / 30_000)        // rotates every 30 seconds
client_key = SHA256(site_id || ":" || bucket || ":" || ua_hash)
ciphertext = plaintext XOR keystream(client_key)
tag        = HMAC-SHA256(client_key, ciphertext)
```

Enable with a single flag:

**Browser:**

```ts
await init({
  endpoint: "https://your-api.com/collect",
  encrypt: true,
});
```

**Server (Node.js):**

```ts
import { decrypt } from "@pradeeparul2/unisights-node";

const handler = async (payload) => {
  if (payload.encrypted) {
    const decrypted = decrypt(payload, "YOUR_SITE_ID");
    await db.events.insert(decrypted);
  }
};
```

**Server (Python):**

```python
from unisights.validator import UnisightsValidator

validator = UnisightsValidator()

if payload.encrypted:
    decrypted_payload = validator.decrypt(payload, "YOUR_SITE_ID")
    await db.events.insert_one(decrypted_payload.data.to_dict())
```

See [`packages/core/README.md`](./packages/core/README.md) for implementation details.

---

## Documentation

### Browser SDK

- **Quick start & API** → [`packages/unisights/README.md`](./packages/unisights/README.md)
- **Configuration** → Tracking options, custom events, script tag usage
- **Examples** → Next.js, Vue, React, plain HTML

### WASM Core

- **Internals & encryption** → [`packages/core/README.md`](./packages/core/README.md)
- **Building from Rust** → Modifying event types, compilation

### Node.js Receiver

- **Framework guides** → [`packages/node/README.md`](./packages/node/README.md)
- **Payload types** → TypeScript definitions, handler patterns
- **Decryption** → Client-side encryption + server verification

### Python Receiver

- **Framework integration** → [`packages/python/README.md`](./packages/python/README.md)
- **Type definitions** → Matching Node.js specification
- **Validation & error handling** → Comprehensive payload validation
- **Examples** → FastAPI, Flask, Django, ASGI
- **Production setup** → Docker, deployment, performance

---

## Development

### Prerequisites

- **Node.js** >= 18
- **Rust + Cargo** — `curl https://sh.rustup.rs -sSf | sh`
- **wasm-pack** — `cargo install wasm-pack`
- **pnpm** — `npm install -g pnpm`
- **Python** >= 3.8 (for Python package development)

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
cd packages/python         && pip install -e .
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

# Python receiver (50+ tests)
cd packages/python
pytest tests/test_validator.py -v
```

### Linting & Formatting

```bash
# TypeScript
pnpm -r lint
pnpm -r format

# Python
cd packages/python
black src/
flake8 src/
```

### CI / CD

Releases publish automatically to npm and PyPI on push to `main`:

#### JavaScript Packages (npm)

1. Restores caches — Rust registry, build artifacts, wasm-pack binary, pnpm store
2. Builds WASM with `wasm-pack build --target web --release`
3. Bundles JS with tsup — WASM binary inlined, no separate `.wasm` file needed
4. Generates `.d.ts` declarations
5. Publishes packages to npm

#### Python Package (PyPI)

1. Builds distribution with `python -m build`
2. Runs tests with `pytest`
3. Publishes to PyPI with `twine upload`

**Bump versions before merging:**

- `packages/core/package.json`
- `packages/unisights/package.json`
- `packages/unisights-node/package.json`
- `packages/python/pyproject.toml`

---

## Contributing

PRs are welcome. Please open an issue first for significant changes.

**Code style:**

- TypeScript: Run `pnpm format` before commit
- Python: Run `black` and `flake8`
- Rust: Run `cargo fmt` and `cargo clippy`

---

## Community

- **Issues** — Report bugs or suggest features on [GitHub](https://github.com/Pradeeparul2/unisights/issues)
- **Discussions** — Join the conversation on [GitHub Discussions](https://github.com/Pradeeparul2/unisights/discussions)

---

## License

MIT © Pradeep Arul

---

## Roadmap

- [ ] Dashboard UI (open-source)
- [ ] Real-time event streaming
- [ ] Advanced segmentation & cohort analysis
- [ ] Multi-workspace management
- [ ] Self-hosted cloud option

---

## Sponsors

Built with ❤️ by [Pradeep Arul](https://github.com/pradeeparul2).

---

## Quick Links

| Link                                          | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| [Browser SDK](./packages/unisights)           | `@pradeeparul2/unisights` — Browser library       |
| [WASM Core](./packages/core)                  | `@pradeeparul2/unisights-core` — Rust/WASM engine |
| [Node.js Receiver](./packages/node)           | `@pradeeparul2/unisights-node` — Server ingestion |
| [Python Receiver](./packages/python)          | `unisights` — FastAPI, Flask, Django support      |
| [Examples](./packages/python/examples)        | Complete implementation examples                  |
| [Encryption Spec](./packages/core#encryption) | Rolling-key algorithm & verification              |
