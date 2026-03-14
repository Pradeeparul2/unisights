# Unisights-node

Server package for the **unisights** ecosystem.

Creates a configurable endpoint that receives events captured by the **unisights**. Processing is optional. **Always returns 200** — the client never blocks on the server response.

[![npm version](https://img.shields.io/npm/v/@pradeeparul2/unisights-node)](https://www.npmjs.com/package/@pradeeparul2/unisights-node)
[![license](https://img.shields.io/npm/l/@pradeeparul2/unisights-node)](./LICENSE)

```
unisights
  → captures events (clicks, page views, errors, custom…)
  → POST /collect  { ...payload }

unisights-node
  → receives the payload
  → optionally runs your handler (save to DB, forward to queue, log…)
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
    await db.events.insert(payload);
  },
});
```

Wire it up with one line for your framework.

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
      console.log("event received:", payload);
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

## Options

| Option    | Type       | Default     | Required | Description                      |
| --------- | ---------- | ----------- | -------- | -------------------------------- |
| `path`    | `string`   | `'/events'` | No       | Endpoint path the server exposes |
| `handler` | `function` | `null`      | No       | `async (payload, req) => void`   |

---

## Handler

```js
handler: async (payload, req) => {
  // payload — parsed JSON body sent by the unisites client SDK
  // req     — raw request object (framework-specific, optional to use)

  // Examples:
  await db.events.insert(payload);
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
- The body is malformed

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
