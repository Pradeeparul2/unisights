import type { UnisightsOptions } from "../types.ts";
export declare function fetchAdapter<TPayload>(config: Required<UnisightsOptions<TPayload>>): (request: Request) => Promise<Response | null>;
