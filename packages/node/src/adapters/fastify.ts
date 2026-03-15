/**
 * adapters/fastify.ts
 *
 * Fastify plugin — registers the POST route automatically.
 * Usage: fastify.register(collector.fastify)
 */

import type { AdapterConfig } from "../types.js";
import { parseBody } from "../parseBody.js";

// Minimal Fastify interfaces we interact with
interface FastifyInstance {
  addContentTypeParser: (
    contentType: string,
    opts: { parseAs: string },
    fn: (
      req: unknown,
      body: string,
      done: (err: Error | null, val?: unknown) => void,
    ) => void,
  ) => void;
  post: (
    path: string,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  ) => void;
  options: (
    path: string,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>,
  ) => void;
}

interface FastifyRequest {
  body?: unknown;
  raw: unknown;
}

interface FastifyReply {
  code: (status: number) => FastifyReply;
  send: (body: unknown) => void;
}

export function fastifyAdapter<TPayload>(
  config: AdapterConfig<TPayload>,
): (fastify: FastifyInstance, opts: unknown) => Promise<void> {
  const { path, handler } = config;

  async function plugin(fastify: FastifyInstance): Promise<void> {
    fastify.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req, body, done) => {
        try {
          done(null, JSON.parse(body));
        } catch {
          done(null, {}); // parse error → empty object, still 200
        }
      },
    );

    fastify.post(path, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = (request.body ??
          (await parseBody(request.raw))) as TPayload;
        if (handler) {
          await handler(payload, request);
        }
      } catch {
        // Swallow — always 200
      }
      reply.code(200).send({ ok: true });
    });

    fastify.options(path, async (_request, reply) => {
      reply.code(200).send({ ok: true });
    });
  }

  // Required Fastify plugin metadata
  (plugin as unknown as Record<symbol, unknown>)[Symbol.for("skip-override")] =
    true;
  (plugin as unknown as Record<symbol, unknown>)[
    Symbol.for("fastify.display-name")
  ] = "unisights";

  return plugin;
}
