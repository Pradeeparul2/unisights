/**
 * adapters/node.ts
 *
 * Node.js middleware — Express, NestJS, Connect, raw http.createServer
 * Signature: (req, res, next?) => void
 *
 * No `node:http` import — compatible with any moduleResolution (bundler, NodeNext, etc.)
 */

import type { AdapterConfig } from "../types.js";
import { parseBody } from "../parseBody.js";

// ── Local interface definitions (replaces node:http imports) ─────────────────

interface NodeResponse {
  headersSent?: boolean;
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(body?: string): void;
  // Express / NestJS additions (optional)
  status?: (code: number) => NodeResponse;
  json?: (body: unknown) => void;
}

interface NodeRequest {
  method?: string;
  url?: string;
  path?: string; // Express sets this
  headers?: Record<string, string>;
  body?: unknown; // Set by Express json(), Fastify, Koa bodyparser
  // EventEmitter interface for raw stream reading
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export function nodeAdapter<TPayload>(
  config: AdapterConfig<TPayload>,
): (req: NodeRequest, res: NodeResponse, next?: () => void) => void {
  const { path, handler } = config;

  return async function uniSightsNode(
    req: NodeRequest,
    res: NodeResponse,
    next?: () => void,
  ): Promise<void> {
    if (getPath(req) !== path) {
      next?.();
      return;
    }

    // Always 200 for OPTIONS (CORS preflight)
    if (req.method === "OPTIONS") {
      writeJson(res, 200, { ok: true });
      return;
    }

    // Only process POST — all other methods still return 200
    if (req.method === "POST") {
      try {
        const payload = (await parseBody(req)) as TPayload;
        if (handler) {
          await handler(payload as TPayload, req);
        }
      } catch {
        // Swallow — always 200
      }
    }

    writeJson(res, 200, { ok: true });
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPath(req: NodeRequest): string {
  // Express sets req.path; raw http req.url may include query string
  const url = req.path ?? req.url ?? "/";
  return url.split("?")[0];
}

function writeJson(res: NodeResponse, status: number, body: unknown): void {
  // Express / NestJS style (.status().json())
  if (typeof res.status === "function" && typeof res.json === "function") {
    const chained = res.status(status) as NodeResponse;
    chained.json!(body);
    return;
  }
  // Raw Node ServerResponse
  if (!res.headersSent) {
    res.writeHead(status, { "Content-Type": "application/json" });
  }
  res.end(JSON.stringify(body));
}
