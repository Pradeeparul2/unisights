import type { UnisightsOptions } from "../types.js";
interface ElysiaApp {
    post: (path: string, handler: (ctx: ElysiaContext) => unknown | Promise<unknown>) => ElysiaApp;
}
interface ElysiaContext {
    body?: unknown;
    set: {
        status?: number;
    };
}
export declare function elysiaAdapter<TPayload>(config: Required<UnisightsOptions<TPayload>>): (app: ElysiaApp) => ElysiaApp;
export {};
