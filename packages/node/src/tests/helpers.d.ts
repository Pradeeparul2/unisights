import { EventEmitter } from "node:events";
export interface MockRequest extends EventEmitter {
    method: string;
    url: string;
    path?: string;
    headers: Record<string, string>;
    body?: unknown;
    simulateBody(json: unknown): void;
}
export declare function makeMockReq(options?: {
    method?: string;
    url?: string;
    path?: string;
    body?: unknown;
    headers?: Record<string, string>;
}): MockRequest;
export interface MockResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    headersSent: boolean;
    status(code: number): MockResponse;
    json(body: unknown): void;
    writeHead(code: number, headers?: Record<string, string>): void;
    end(body?: string): void;
    done: Promise<{
        statusCode: number;
        body: string;
        headers: Record<string, string>;
    }>;
}
export declare function makeMockRes(): MockResponse;
export declare function makeFetchRequest(options?: {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: Record<string, string>;
}): Request;
export interface MockHonoContext {
    req: {
        url: string;
        method: string;
        json: <T = unknown>() => Promise<T>;
    };
    json: (body: unknown, status?: number) => Response;
    _response: Response | null;
}
export declare function makeMockHonoCtx(options?: {
    url?: string;
    method?: string;
    body?: unknown;
}): MockHonoContext;
export interface MockKoaContext {
    path: string;
    method: string;
    status: number;
    body: unknown;
    req: MockRequest;
    request: {
        body?: unknown;
    };
}
export declare function makeMockKoaCtx(options?: {
    path?: string;
    method?: string;
    requestBody?: unknown;
}): MockKoaContext;
export interface MockElysiaContext {
    body?: unknown;
    set: {
        status?: number;
    };
}
export declare function makeMockElysiaCtx(body?: unknown): MockElysiaContext;
export interface MockElysiaApp {
    routes: Array<{
        path: string;
        handler: (ctx: MockElysiaContext) => unknown | Promise<unknown>;
    }>;
    post(path: string, handler: (ctx: MockElysiaContext) => unknown): MockElysiaApp;
    callPost(body: unknown): Promise<unknown>;
}
export declare function makeMockElysiaApp(): MockElysiaApp;
