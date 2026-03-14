/**
 * parseBody.ts
 *
 * Parses a JSON POST body from any runtime request shape:
 *   - Express / NestJS / Connect  → req.body pre-parsed by framework
 *   - Fastify                     → request.body pre-parsed
 *   - Koa                         → ctx.request.body or raw stream
 *   - Raw Node http               → reads IncomingMessage stream
 *   - Web Fetch API Request       → Cloudflare Workers, Deno, Bun, Vercel, Netlify, Hono, Elysia
 *
 * No `node:http` import — compatible with any moduleResolution (bundler, NodeNext, etc.)
 */

// ── Local type definitions (no node:http dependency) ─────────────────────────

interface NodeRequestWithBody {
  body?: unknown;
}

interface WebRequestLike {
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}

// Minimal EventEmitter-style stream shape (matches Node IncomingMessage)
interface NodeStream {
  on(event: "data", listener: (chunk: Uint8Array | string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function createError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

/**
 * Parse JSON body from any supported runtime request object.
 */
export async function parseBody(req: unknown): Promise<unknown> {
  // ── 1. Web Fetch API Request — MUST come before pre-parsed body check ──────
  // Node 18+ Request.body is a ReadableStream (truthy, not undefined).
  // Checking pre-parsed body first would return the raw stream as the value.
  if (isWebRequest(req)) {
    const text = await (req as WebRequestLike).text();
    return safeParse(text);
  }

  // ── 2. Framework pre-parsed body (Express, NestJS, Fastify, Koa+bodyparser) ──
  const nodeReq = req as NodeRequestWithBody;
  if (nodeReq.body !== undefined && nodeReq.body !== null) {
    if (typeof nodeReq.body === "string") {
      return safeParse(nodeReq.body);
    }
    return nodeReq.body;
  }

  // ── 3. Raw Node IncomingMessage stream ────────────────────────────────────
  if (isNodeStream(req)) {
    return readStream(req as NodeStream);
  }

  throw createError(400, "Cannot read request body");
}

// ── Guards ────────────────────────────────────────────────────────────────────

function isWebRequest(req: unknown): req is WebRequestLike {
  return (
    req !== null &&
    typeof req === "object" &&
    typeof (req as WebRequestLike).text === "function" &&
    typeof (req as WebRequestLike).headers?.get === "function"
  );
}

function isNodeStream(req: unknown): req is NodeStream {
  return (
    req !== null &&
    typeof req === "object" &&
    typeof (req as NodeStream).on === "function"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeParse(text: string): unknown {
  if (!text || !text.trim()) {
    throw createError(400, "Empty request body");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw createError(400, "Invalid JSON body");
  }
}

function readStream(req: NodeStream): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: (Uint8Array | string)[] = [];

    req.on("data", (chunk) => chunks.push(chunk));

    req.on("end", () => {
      try {
        // TextDecoder works in Node 18+ and all edge runtimes — no Buffer needed
        const decoder = new TextDecoder();
        const raw = chunks
          .map((c) => (typeof c === "string" ? c : decoder.decode(c)))
          .join("");
        resolve(safeParse(raw));
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", (err) => reject(err));
  });
}
