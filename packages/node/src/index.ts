/**
 * unisights-node
 *
 * Creates a configurable endpoint that receives events from the unisites client SDK.
 * Processing is optional. Always returns 200.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { unisites } from 'unisights-node'
 *
 *   const collector = unisites({
 *     path: '/collect',              // default: '/events'
 *     handler: async (payload) => {  // optional
 *       await db.insert(payload)
 *     }
 *   })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Express / NestJS / raw http      app.use(collector)
 *   Koa                              app.use(collector.koa)
 *   Fastify                          fastify.register(collector.fastify)
 *   Hono                             app.use('*', collector.hono)
 *   Elysia                           collector.elysia(app)
 *   Cloudflare Workers               export default { fetch: collector.fetch }
 *   Cloudflare Pages                 export const onRequestPost = (ctx) => collector.fetch(ctx.request)
 *   Deno                             Deno.serve(collector.fetch)
 *   Bun (native)                     export default { fetch: collector.fetch }
 *   Vercel Edge                      export default (req) => collector.fetch(req)
 *   Netlify Edge                     export default (req) => collector.fetch(req)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { UnisightsOptions, UnisightsCollector, Handler } from "./types.js";
import { fetchAdapter } from "./adapters/fetch.js";
import { nodeAdapter } from "./adapters/node.js";
import { fastifyAdapter } from "./adapters/fastify.js";
import { koaAdapter } from "./adapters/koa.js";
import { honoAdapter } from "./adapters/hono.js";
import { elysiaAdapter } from "./adapters/elysia.js";

export type { UnisightsOptions, UnisightsCollector, Handler };

/**
 * Create a unisites event collection endpoint.
 *
 * @param options.path    - endpoint path (default: '/events')
 * @param options.handler - optional async (payload, req) => void
 *
 */
export function unisights<TPayload = unknown>(
  options: UnisightsOptions<TPayload> = {},
): UnisightsCollector {
  const { path = "/events", handler = null } = options;

  // ── Validate ──────────────────────────────────────────────────────────────

  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error(
      '[unisights] options.path must be a string starting with "/"',
    );
  }

  if (handler !== null && typeof handler !== "function") {
    throw new Error("[unisights] options.handler must be a function");
  }

  const config: Required<UnisightsOptions<TPayload>> = {
    path,
    handler: handler as Handler<TPayload>,
  };

  // ── Build adapters ────────────────────────────────────────────────────────

  const node = nodeAdapter(config);
  const fastify = fastifyAdapter(config);
  const koa = koaAdapter(config);
  const fetch = fetchAdapter(config);
  const hono = honoAdapter(config);
  const elysia = elysiaAdapter(config);

  // ── Collector: base is a Node middleware fn ───────────────────────────────

  const collector = function (
    req: unknown,
    res: unknown,
    next?: () => void,
  ): void {
    node(
      req as Parameters<typeof node>[0],
      res as Parameters<typeof node>[1],
      next,
    );
  } as UnisightsCollector;

  // Named surfaces
  collector.fastify = fastify as UnisightsCollector["fastify"];
  collector.koa = koa as UnisightsCollector["koa"];
  collector.fetch = fetch as UnisightsCollector["fetch"];
  collector.hono = hono as UnisightsCollector["hono"];
  collector.elysia = elysia as UnisightsCollector["elysia"];

  // Introspection
  Object.defineProperties(collector, {
    path: { value: path, writable: false, enumerable: true },
    handler: { value: handler, writable: false, enumerable: true },
  });

  return collector;
}

export default unisights;
