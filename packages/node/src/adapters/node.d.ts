import type { UnisightsOptions } from "../types.js";
interface NodeResponse {
    headersSent?: boolean;
    writeHead(statusCode: number, headers?: Record<string, string>): void;
    end(body?: string): void;
    status?: (code: number) => NodeResponse;
    json?: (body: unknown) => void;
}
interface NodeRequest {
    method?: string;
    url?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: unknown;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
}
export declare function nodeAdapter<TPayload>(config: Required<UnisightsOptions<TPayload>>): (req: NodeRequest, res: NodeResponse, next?: () => void) => void;
export {};
