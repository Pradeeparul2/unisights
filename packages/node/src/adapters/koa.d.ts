import type { UnisightsOptions } from "../types.js";
interface KoaContext {
    path: string;
    method: string;
    status: number;
    body: unknown;
    req: unknown;
    request: {
        body?: unknown;
    };
}
export declare function koaAdapter<TPayload>(config: Required<UnisightsOptions<TPayload>>): (ctx: KoaContext, next: () => Promise<void>) => Promise<void>;
export {};
