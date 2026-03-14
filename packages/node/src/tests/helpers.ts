/**
 * tests/helpers.ts
 * Shared test utilities and mock factories used across all test files.
 */

import { EventEmitter } from "node:events";

// ── Mock Node Request ─────────────────────────────────────────────────────────

export interface MockRequest extends EventEmitter {
  method: string;
  url: string;
  path?: string;
  headers: Record<string, string>;
  body?: unknown;
  /** Emit chunks then 'end' to simulate a streaming body */
  simulateBody(json: unknown): void;
}

export function makeMockReq(
  options: {
    method?: string;
    url?: string;
    path?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): MockRequest {
  const emitter = new EventEmitter() as MockRequest;
  emitter.method = options.method ?? "POST";
  emitter.url = options.url ?? "/events";
  emitter.path = options.path;
  emitter.headers = { "content-type": "application/json", ...options.headers };
  emitter.body = options.body;

  emitter.simulateBody = (json: unknown) => {
    const chunk = Buffer.from(JSON.stringify(json));
    // nextTick so the caller can attach listeners first
    process.nextTick(() => {
      emitter.emit("data", chunk);
      emitter.emit("end");
    });
  };

  return emitter;
}

// ── Mock Node Response ────────────────────────────────────────────────────────

export interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  headersSent: boolean;
  // Express-style chainable API
  status(code: number): MockResponse;
  json(body: unknown): void;
  // Raw Node API
  writeHead(code: number, headers?: Record<string, string>): void;
  end(body?: string): void;
  // Resolved when end() is called
  done: Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }>;
}

export function makeMockRes(): MockResponse {
  let resolve!: (v: {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }) => void;
  const done = new Promise<{
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }>((r) => (resolve = r));

  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: "",
    headersSent: false,
    done,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = JSON.stringify(body);
      resolve({
        statusCode: res.statusCode,
        body: res.body,
        headers: res.headers,
      });
    },
    writeHead(code, headers = {}) {
      res.statusCode = code;
      res.headers = { ...res.headers, ...headers };
      res.headersSent = true;
    },
    end(body = "") {
      res.body = body;
      resolve({
        statusCode: res.statusCode,
        body: res.body,
        headers: res.headers,
      });
    },
  };

  return res;
}

// ── Mock Web Fetch API Request ────────────────────────────────────────────────

export function makeFetchRequest(
  options: {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  const {
    method = "POST",
    url = "http://localhost/events",
    body,
    headers = {},
  } = options;
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ── Hono Context Mock ─────────────────────────────────────────────────────────

export interface MockHonoContext {
  req: {
    url: string;
    method: string;
    json: <T = unknown>() => Promise<T>;
  };
  json: (body: unknown, status?: number) => Response;
  _response: Response | null;
}

export function makeMockHonoCtx(
  options: {
    url?: string;
    method?: string;
    body?: unknown;
  } = {},
): MockHonoContext {
  const {
    url = "http://localhost/events",
    method = "POST",
    body = {},
  } = options;
  const ctx: MockHonoContext = {
    req: {
      url,
      method,
      json: async <T>() => body as T,
    },
    json(responseBody: unknown, _status = 200) {
      const res = new Response(JSON.stringify(responseBody), {
        status: _status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
      ctx._response = res;
      return res;
    },
    _response: null,
  };
  return ctx;
}

// ── Koa Context Mock ──────────────────────────────────────────────────────────

export interface MockKoaContext {
  path: string;
  method: string;
  status: number;
  body: unknown;
  req: MockRequest;
  request: { body?: unknown };
}

export function makeMockKoaCtx(
  options: {
    path?: string;
    method?: string;
    requestBody?: unknown;
  } = {},
): MockKoaContext {
  const req = makeMockReq({
    method: options.method ?? "POST",
    url: options.path ?? "/events",
  });
  return {
    path: options.path ?? "/events",
    method: options.method ?? "POST",
    status: 200,
    body: null,
    req,
    request: { body: options.requestBody },
  };
}

// ── Elysia Context Mock ───────────────────────────────────────────────────────

export interface MockElysiaContext {
  body?: unknown;
  set: { status?: number };
}

export function makeMockElysiaCtx(body: unknown = {}): MockElysiaContext {
  return { body, set: {} };
}

// ── Elysia App Mock ───────────────────────────────────────────────────────────

export interface MockElysiaApp {
  routes: Array<{
    path: string;
    handler: (ctx: MockElysiaContext) => unknown | Promise<unknown>;
  }>;
  post(
    path: string,
    handler: (ctx: MockElysiaContext) => unknown,
  ): MockElysiaApp;
  callPost(body: unknown): Promise<unknown>;
}

export function makeMockElysiaApp(): MockElysiaApp {
  const app: MockElysiaApp = {
    routes: [],
    post(path, handler) {
      app.routes.push({ path, handler });
      return app;
    },
    async callPost(body) {
      const route = app.routes[0];
      if (!route) throw new Error("No route registered");
      return route.handler(makeMockElysiaCtx(body));
    },
  };
  return app;
}
