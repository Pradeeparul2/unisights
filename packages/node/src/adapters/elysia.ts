/**
 * adapters/elysia.ts
 *
 * Elysia (Bun) adapter — registers the POST route on an Elysia instance.
 * Usage: collector.elysia(app)
 */

import type { AdapterConfig } from "../types.js";

// Minimal Elysia app interface we depend on
interface ElysiaApp {
  post: (
    path: string,
    handler: (ctx: ElysiaContext) => unknown | Promise<unknown>,
  ) => ElysiaApp;
}

interface ElysiaContext {
  body?: unknown;
  set: { status?: number };
}

export function elysiaAdapter<TPayload>(
  config: AdapterConfig<TPayload>,
): (app: ElysiaApp) => ElysiaApp {
  const { path, handler } = config;

  return function applyToElysia(app: ElysiaApp): ElysiaApp {
    app.post(path, async (ctx: ElysiaContext) => {
      try {
        const payload = (ctx.body ?? {}) as TPayload;
        if (handler) {
          await handler(payload, ctx);
        }
      } catch {
        // Swallow — always 200
      }
      return { ok: true };
    });

    return app;
  };
}
