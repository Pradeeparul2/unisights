import type { UnisightsOptions } from "../types.js";
interface FastifyInstance {
    addContentTypeParser: (contentType: string, opts: {
        parseAs: string;
    }, fn: (req: unknown, body: string, done: (err: Error | null, val?: unknown) => void) => void) => void;
    post: (path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>) => void;
    options: (path: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>) => void;
}
interface FastifyRequest {
    body?: unknown;
    raw: unknown;
}
interface FastifyReply {
    code: (status: number) => FastifyReply;
    send: (body: unknown) => void;
}
export declare function fastifyAdapter<TPayload>(config: Required<UnisightsOptions<TPayload>>): (fastify: FastifyInstance, opts: unknown) => Promise<void>;
export {};
