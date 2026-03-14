/**
 * types.ts — shared types for @pradeeparul2/unisights-node
 */

// ── Payload — Event types ─────────────────────────────────────────────────────

export interface PageViewEventData {
  location: string;
  title: string;
  timestamp: number;
}

export interface ClickEventData {
  x: number;
  y: number;
  timestamp: number;
}

export interface WebVitalEventData {
  name: "FCP" | "LCP" | "CLS" | "INP" | "TTFB" | "FID" | (string & {});
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  entries: number;
  navigation_type: string;
  timestamp: number;
}

export interface CustomEventData {
  name: string;
  /** JSON-encoded string of arbitrary custom data */
  data: string;
  timestamp: number;
}

export interface ErrorEventData {
  message: string;
  source: string;
  lineno: number;
  colno: number;
  timestamp: number;
}

/** Discriminated union of all event types */
export type UnisightsEvent =
  | { type: "page_view"; data: PageViewEventData }
  | { type: "click"; data: ClickEventData }
  | { type: "web_vital"; data: WebVitalEventData }
  | { type: "custom"; data: CustomEventData }
  | { type: "error"; data: ErrorEventData };

// ── Payload — Top-level shape ─────────────────────────────────────────────────

export interface DeviceInfo {
  browser: string;
  os: string;
  device_type: "Desktop" | "Mobile" | "Tablet" | (string & {});
}

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  [key: string]: string | undefined;
}

export interface UnisightsData {
  /** Your Unisights asset/property ID */
  asset_id: string;
  /** UUID v4 session identifier */
  session_id: string;
  /** Current page URL */
  page_url: string;
  /** First page the user landed on in this session */
  entry_page: string;
  /** Last page before session ended — null if session is still active */
  exit_page: string | null;
  /** UTM tracking parameters */
  utm_params: UtmParams;
  /** Device/browser information */
  device_info: DeviceInfo;
  /** Percentage of page scrolled (0–100) */
  scroll_depth: number;
  /** Time on page in seconds */
  time_on_page: number;
  /** Ordered list of captured events */
  events: UnisightsEvent[];
}

/**
 * Top-level payload POSTed by the unisights client SDK.
 * This is what your handler receives as its first argument.
 */
export interface UnisightsPayload {
  data: UnisightsData;
  /** Whether the payload data is encrypted */
  encrypted: boolean;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * Optional event handler called with the parsed payload from the client SDK.
 *
 * - Return value is ignored.
 * - Errors are swallowed — the client always receives 200.
 *
 * @param payload - parsed UnisightsPayload sent by the unisights client
 * @param req     - raw request object (framework-specific)
 */
export type Handler<TPayload = UnisightsPayload, TReq = unknown> = (
  payload: TPayload,
  req: TReq,
) => void | Promise<void>;

// ── Options ───────────────────────────────────────────────────────────────────

export interface UnisightsOptions<TPayload = UnisightsPayload> {
  /**
   * Endpoint path to expose.
   * @default '/events'
   */
  path?: string;

  /**
   * Optional handler called for each received payload.
   * async (payload, req) => void
   */
  handler?: Handler<TPayload>;
}

// ── Collector (returned by unisights()) ───────────────────────────────────────

/**
 * The object returned by `unisights()`.
 * Wire it up once — works on every framework.
 */
export interface UnisightsCollector {
  /**
   * Node.js middleware — Express, NestJS, Connect, raw http.createServer
   * @example app.use(collector)
   */
  (req: unknown, res: unknown, next?: () => void): void;

  /**
   * Fastify plugin
   * @example fastify.register(collector.fastify)
   */
  fastify: (fastify: unknown, opts: unknown) => Promise<void>;

  /**
   * Koa middleware
   * @example app.use(collector.koa)
   */
  koa: (ctx: unknown, next: () => Promise<void>) => Promise<void>;

  /**
   * Web Fetch API handler — Cloudflare Workers, Deno, Bun, Vercel Edge, Netlify Edge.
   * Returns null when the path does not match so you can chain other routes.
   * @example export default { fetch: collector.fetch }
   */
  fetch: (request: Request) => Promise<Response | null>;

  /**
   * Hono middleware — works on all Hono-supported runtimes
   * @example app.use('*', collector.hono)
   */
  hono: (c: unknown, next: () => Promise<void>) => Promise<Response>;

  /**
   * Elysia (Bun) plugin
   * @example collector.elysia(app)
   */
  elysia: (app: unknown) => unknown;

  /** Configured path (read-only) */
  readonly path: string;

  /** Configured handler, or null if not provided (read-only) */
  readonly handler: Handler | null;
}
