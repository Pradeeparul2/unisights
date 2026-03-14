/**
 * adapters/koa.ts
 *
 * Koa middleware — (ctx, next) => void
 * Usage: app.use(collector.koa)
 */

import type { UnisightsOptions } from "../types.js";
import { parseBody } from "../parseBody.js";

// Minimal Koa context shape we depend on
interface KoaContext {
  path: string;
  method: string;
  status: number;
  body: unknown;
  req: unknown; // raw Node IncomingMessage
  request: {
    body?: unknown;
  };
}

export function koaAdapter<TPayload>(
  config: Required<UnisightsOptions<TPayload>>,
): (ctx: KoaContext, next: () => Promise<void>) => Promise<void> {
  const { path, handler } = config;

  return async function uniSitesKoa(
    ctx: KoaContext,
    next: () => Promise<void>,
  ): Promise<void> {
    if (ctx.path !== path) {
      await next();
      return;
    }

    if (ctx.method === "POST") {
      try {
        // koa-bodyparser sets ctx.request.body; fallback to raw stream
        const payload = (
          ctx.request.body !== undefined
            ? ctx.request.body
            : await parseBody(ctx.req)
        ) as TPayload;

        if (handler) {
          await handler(payload, ctx);
        }
      } catch {
        // Swallow — always 200
      }
    }

    ctx.status = 200;
    ctx.body = { ok: true };
  };
}
