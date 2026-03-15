# Unisights Node

Server package for the **unisights** ecosystem.

Creates a configurable endpoint that receives events captured by the **unisights** client SDK. Processing is optional. **Always returns 200** — the client never blocks on the server response. Encrypted payloads are **automatically decrypted** before reaching your handler.

[![npm version](https://img.shields.io/npm/v/@pradeeparul2/unisights-node)](https://www.npmjs.com/package/@pradeeparul2/unisights-node)
[![license](https://img.shields.io/npm/l/@pradeeparul2/unisights-node)](./LICENSE)

```
unisights client SDK
  → captures events (clicks, page views, errors, custom…)
  → POST /collect  { ...payload }          ← plain or encrypted

unisights-node
  → receives the payload
  → auto-decrypts if encrypted: true
  → calls your handler(UnisightsPayload)   ← always decrypted
  → always responds 200 { ok: true }
```

---

## Install

```bash
npm install @pradeeparul2/unisights-node
```

---

## Basic usage

```js
import { unisights } from "@pradeeparul2/unisights-node";

// No handler — just open the endpoint and return 200
const collector = unisights({ path: "/collect" });

// With optional processing
const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    // payload is always UnisightsPayload — encrypted or not
    await db.events.insert(payload.data);
  },
});
```

---

## Express

```js
import express from "express";
import { unisights } from "@pradeeparul2/unisights-node";

const app = express();

app.use(
  unisights({
    path: "/collect",
    handler: async (payload) => {
      console.log("event received:", payload.data);
    },
  }),
);

app.listen(3000);
```

---

## NestJS

```ts
// main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { unisights } from "@pradeeparul2/unisights-node";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    unisights({
      path: "/collect",
      handler: async (payload) => {
        console.log(payload);
      },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

---

## Fastify

```js
import Fastify from "fastify";
import { unisights } from "@pradeeparul2/unisights-node";

const fastify = Fastify();

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

fastify.register(collector.fastify);

fastify.listen({ port: 3000 });
```

---

## Koa

```js
import Koa from "koa";
import { unisights } from "@pradeeparul2/unisights-node";

const app = new Koa();

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

app.use(collector.koa);
app.listen(3000);
```

---

## Raw Node.js `http`

```js
import http from "node:http";
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

http.createServer(collector).listen(3000);
```

---

## Hono

Works on Cloudflare Workers, Bun, Deno, Node — anywhere Hono runs.

```js
import { Hono } from "hono";
import { unisights } from "@pradeeparul2/unisights-node";

const app = new Hono();

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

app.use("*", collector.hono);

export default app;
```

---

## Cloudflare Workers

```js
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload, request) => {
    // payload is always the decrypted UnisightsPayload
    // request is the raw Web Fetch API Request
    await fetch("https://ingest.myservice.com", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
});

export default {
  fetch: collector.fetch,
};
```

---

## Cloudflare Pages Functions

```js
// functions/collect.js
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

export async function onRequestPost(context) {
  return collector.fetch(context.request);
}
```

---

## Deno / Deno Deploy

```ts
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

Deno.serve(collector.fetch);
```

---

## Bun (native HTTP)

```js
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

export default {
  fetch: collector.fetch,
};
```

---

## Elysia (Bun)

```js
import { Elysia } from "elysia";
import { unisights } from "@pradeeparul2/unisights-node";

const app = new Elysia();

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

collector.elysia(app);

app.listen(3000);
```

---

## Vercel Edge Functions

```js
// api/collect.js
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/api/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

export const config = { runtime: "edge" };

export default (request) => collector.fetch(request);
```

---

## Netlify Edge Functions

```js
// netlify/edge-functions/collect.js
import { unisights } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    console.log(payload);
  },
});

export default (request) => collector.fetch(request);

export const config = { path: "/collect" };
```

---

## Encryption

When the unisights client SDK is initialised with `encrypt: true`, payloads are encrypted before being sent. **unisights-node detects and decrypts them automatically** — your handler always receives a plain `UnisightsPayload`, regardless of whether encryption was enabled on the client.

```js
// Nothing changes in your server code — decryption is transparent
const collector = unisights({
  path: "/collect",
  handler: async (payload) => {
    // payload is UnisightsPayload whether the SDK sent it encrypted or not
    await db.events.insert(payload.data);
  },
});
```

### How it works

The SDK derives an encryption key entirely from public, reproducible inputs — no secret is stored in or transmitted from the browser:

```
bucket     = floor(timestamp_ms / 30_000)        // rotates every 30 seconds
client_key = SHA256(site_id + ":" + bucket + ":" + ua_hash)
ciphertext = plaintext XOR keystream(client_key)
tag        = HMAC-SHA256(client_key, ciphertext)
```

The server receives `site_id`, `ua_hash`, and `bucket` in the payload envelope and independently reproduces `client_key` to verify the HMAC tag and decrypt — no session state needed.

An encrypted payload looks like this when it arrives at the server:

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

### Optional server-side secret

For an additional layer of security, configure a server secret. When set, the key is wrapped with an extra HMAC step:

```
server_key = HMAC-SHA256(SERVER_SECRET, client_key)
```

Pass the same secret to `unisights()` — decryption remains transparent:

```js
const collector = unisights({
  path: "/collect",
  serverSecret: process.env.UNISIGHTS_SECRET,
  handler: async (payload) => {
    await db.events.insert(payload.data);
  },
});
```

> The `serverSecret` must match what the SDK was configured with. If tag verification fails (wrong secret, tampered payload, or mismatched inputs), the error is swallowed and the client still receives `200 { ok: true }`.

### Manual decrypt

If you need direct control, `decrypt` and `isEncrypted` are also exported:

```js
import { unisights, decrypt, isEncrypted } from "@pradeeparul2/unisights-node";

const collector = unisights({
  path: "/collect",
  handler: async (raw) => {
    const payload = isEncrypted(raw)
      ? await decrypt(raw, { serverSecret: process.env.UNISIGHTS_SECRET })
      : raw;

    await db.events.insert(payload.data);
  },
});
```

---

## Payload shape

Every call to your handler receives a `UnisightsPayload`. All types are exported from `@pradeeparul2/unisights-node`.

```ts
interface UnisightsPayload {
  data: {
    asset_id: string; // your Unisights property ID
    session_id: string; // UUID v4
    page_url: string;
    entry_page: string;
    exit_page: string | null;
    utm_params: UtmParams;
    device_info: DeviceInfo; // browser, os, device_type
    scroll_depth: number; // 0–100
    time_on_page: number; // seconds
    events: UnisightsEvent[]; // discriminated union
  };
  encrypted: boolean;
}
```

`events` is a discriminated union — TypeScript narrows the `data` shape for each `type` automatically:

```ts
type UnisightsEvent =
  | { type: "page_view"; data: PageViewEventData }
  | { type: "click"; data: ClickEventData }
  | { type: "web_vital"; data: WebVitalEventData }
  | { type: "custom"; data: CustomEventData }
  | { type: "error"; data: ErrorEventData };
```

```ts
for (const event of payload.data.events) {
  switch (event.type) {
    case "page_view": // event.data → PageViewEventData ✓
    case "click": // event.data → ClickEventData ✓
    case "web_vital": // event.data → WebVitalEventData ✓
    case "custom": // event.data → CustomEventData ✓
    case "error": // event.data → ErrorEventData ✓
  }
}
```

---

## TypeScript

The package is written in TypeScript and ships full type definitions:

```ts
import { unisights } from "@pradeeparul2/unisights-node";
import type {
  UnisightsPayload,
  UnisightsEvent,
  EncryptedPayload,
  DecryptOptions,
} from "@pradeeparul2/unisights-node";

const collector = unisights<UnisightsPayload>({
  path: "/collect",
  serverSecret: process.env.UNISIGHTS_SECRET,
  handler: async (payload) => {
    // payload fully typed ✓
    const clicks = payload.data.events.filter((e) => e.type === "click");
  },
});
```

---

## Options

| Option         | Type       | Default     | Required | Description                                                  |
| -------------- | ---------- | ----------- | -------- | ------------------------------------------------------------ |
| `path`         | `string`   | `'/events'` | No       | Endpoint path the server exposes                             |
| `handler`      | `function` | `null`      | No       | `async (payload, req) => void`                               |
| `serverSecret` | `string`   | `undefined` | No       | Server-side HMAC wrapping secret — must match the SDK config |

---

## Handler

```js
handler: async (payload, req) => {
  // payload — UnisightsPayload (always decrypted, even if the SDK sent it encrypted)
  // req     — raw request object (framework-specific, optional to use)

  await db.events.insert(payload.data);
  await queue.publish("events", payload);
  await fetch("https://downstream.service/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // Return value is ignored.
  // Errors thrown here are swallowed — client always receives 200.
};
```

---

## Always 200

The server **always** responds `200 { ok: true }` regardless of whether:

- The handler is provided or not
- The handler throws an error
- The payload is malformed
- Decryption fails (tag mismatch, tampered payload, wrong secret)

This matches analytics/telemetry collector behaviour — the client SDK should never block user interactions waiting on the server.

---

## Framework surface map

```
collector                  → Express, NestJS, Connect, raw http
collector.fastify          → Fastify plugin
collector.koa              → Koa middleware
collector.fetch            → Cloudflare Workers, Deno, Bun, Vercel Edge, Netlify Edge
collector.hono             → Hono (all platforms)
collector.elysia(app)      → Elysia (Bun)
```

---

## License

MIT
