/**
 * adapters/fetch.ts
 *
 * Web Fetch API handler — one implementation for every edge runtime:
 *   Cloudflare Workers, Cloudflare Pages, Deno, Bun,
 *   Vercel Edge, Netlify Edge, AWS Lambda@Edge
 *
 * Returns null for non-matching paths so you can chain other routes.
 * Usage: export default { fetch: collector.fetch }
 */

import type { AdapterConfig } from "../types.js";

const OK_RESPONSE = JSON.stringify({ ok: true });
const JSON_HEADERS: HeadersInit = { "Content-Type": "application/json" };

export function fetchAdapter<TPayload>(
  config: AdapterConfig<TPayload>,
): (request: Request) => Promise<Response | null> {
  const { path, handler } = config;

  return async function uniSightsFetch(
    request: Request,
  ): Promise<Response | null> {
    const url = new URL(request.url);

    // Not our path — return null so the caller can route elsewhere
    if (url.pathname !== path) return null;

    if (request.method === "POST") {
      try {
        const payload = (await request.json().catch(() => ({}))) as TPayload;
        if (handler) {
          await handler(payload, request);
        }
      } catch {
        // Swallow — always 200
      }
    }

    return new Response(OK_RESPONSE, {
      status: 200,
      headers: JSON_HEADERS,
    });
  };
}
