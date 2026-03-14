import type { UnisightsOptions } from "../types.js";
interface HonoContext {
    req: {
        url: string;
        method: string;
        json: <T = unknown>() => Promise<T>;
    };
    json: (body: unknown, status?: number) => Response;
    next: () => Promise<void>;
}
export declare function honoAdapter<TPayload>(config: Required<UnisightsOptions<TPayload>>): (c: HonoContext, next: () => Promise<void>) => Promise<Response | void>;
export {};
