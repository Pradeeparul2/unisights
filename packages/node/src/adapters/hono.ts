/**
 * adapters/hono.ts
 *
 * Hono middleware — works on CF Workers, Deno, Bun, Node, anywhere Hono runs.
 * Usage: app.use('*', collector.hono)
 */

import type { UnisightsOptions } from "../types.js";

// Minimal Hono context shape we depend on
interface HonoContext {
  req: {
    url: string;
    method: string;
    json: <T = unknown>() => Promise<T>;
  };
  json: (body: unknown, status?: number) => Response;
  next: () => Promise<void>;
}

export function honoAdapter<TPayload>(
  config: Required<UnisightsOptions<TPayload>>,
): (c: HonoContext, next: () => Promise<void>) => Promise<Response | void> {
  const { path, handler } = config;

  return async function uniSitesHono(
    c: HonoContext,
    next: () => Promise<void>,
  ): Promise<Response | void> {
    const url = new URL(c.req.url);

    if (url.pathname !== path) return next();

    if (c.req.method === "POST") {
      try {
        const payload = await c.req
          .json<TPayload>()
          .catch(() => ({}) as TPayload);
        if (handler) {
          await handler(payload, c);
        }
      } catch {
        // Swallow — always 200
      }
    }

    return c.json({ ok: true }, 200);
  };
}
