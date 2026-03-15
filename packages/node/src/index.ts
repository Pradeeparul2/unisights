/**
 * @pradeeparul2/unisights-node
 *
 * Creates a configurable endpoint that receives events from the unisights client SDK.
 * Processing is optional. Always returns 200.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { unisights } from '@pradeeparul2/unisights-node'
 *
 *   const collector = unisights({
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

import type {
  UnisightsOptions,
  UnisightsCollector,
  AdapterConfig,
  Handler,
  UnisightsPayload,
  UnisightsData,
  UnisightsEvent,
  DeviceInfo,
  UtmParams,
  PageViewEventData,
  ClickEventData,
  WebVitalEventData,
  CustomEventData,
  ErrorEventData,
  EncryptedPayload,
  RawPayload,
  DecryptOptions,
} from "./types.js";
import { nodeAdapter } from "./adapters/node.js";
import { fastifyAdapter } from "./adapters/fastify.js";
import { koaAdapter } from "./adapters/koa.js";
import { fetchAdapter } from "./adapters/fetch.js";
import { honoAdapter } from "./adapters/hono.js";
import { elysiaAdapter } from "./adapters/elysia.js";
import { decrypt, isEncrypted } from "./decrypt.js";
export { decrypt, isEncrypted, DecryptError } from "./decrypt.js";

export type {
  UnisightsOptions,
  UnisightsCollector,
  Handler,
  UnisightsPayload,
  UnisightsData,
  UnisightsEvent,
  DeviceInfo,
  UtmParams,
  PageViewEventData,
  ClickEventData,
  WebVitalEventData,
  CustomEventData,
  ErrorEventData,
  EncryptedPayload,
  RawPayload,
  DecryptOptions,
};

/**
 * Create a unisights event collection endpoint.
 *
 * @param options.path    - endpoint path (default: '/events')
 * @param options.handler - optional async (payload, req) => void
 *
 * @example
 * // No handler — just acknowledge every POST and return 200
 * const collector = unisights({ path: '/collect' })
 * app.use(collector)
 *
 * @example
 * // Encryption is handled transparently — handler always receives UnisightsPayload
 * const collector = unisights({
 *   path: '/collect',
 *   handler: async (payload) => {
 *     // payload is UnisightsPayload whether or not the SDK sent it encrypted
 *     await db.events.insert(payload.data)
 *   }
 * })
 *
 * @example
 * // With optional server-side secret (only if SDK is configured with matching secret)
 * const collector = unisights({
 *   path: '/collect',
 *   serverSecret: process.env.UNISIGHTS_SECRET,
 *   handler: async (payload) => {
 *     await db.events.insert(payload.data)
 *   }
 * })
 */
export function unisights<TPayload = unknown>(
  options: UnisightsOptions<TPayload> = {},
): UnisightsCollector {
  const { path = "/events", handler = null, serverSecret } = options;

  // ── Validate ──────────────────────────────────────────────────────────────

  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error(
      '[unisights] options.path must be a string starting with "/"',
    );
  }

  if (handler !== null && typeof handler !== "function") {
    throw new Error("[unisights] options.handler must be a function");
  }

  // Wrap user handler with auto-decrypt — transparently decrypts encrypted
  // payloads before calling the user's function. They always receive UnisightsPayload.
  const wrappedHandler = handler
    ? async (raw: unknown, req: unknown): Promise<void> => {
        const payload = isEncrypted(raw)
          ? await decrypt(raw, { serverSecret })
          : raw;
        await (handler as Handler<unknown>)(payload, req);
      }
    : null;

  const config: AdapterConfig<TPayload> = {
    path,
    handler: wrappedHandler as Handler<TPayload>,
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
