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
   * When the SDK sends an encrypted payload, unisights-node automatically
   * decrypts it before calling this function — no manual decrypt() needed.
   * async (payload, req) => void
   */
  handler?: Handler<TPayload>;

  /**
   * Optional server-side secret for HMAC key wrapping.
   * Only needed if the SDK was configured with the matching server secret.
   * When provided: server_key = HMAC(serverSecret, client_key)
   */
  serverSecret?: string;
}

// ── Internal adapter config (used by adapters — serverSecret already consumed) ──

/**
 * What each adapter receives. serverSecret is handled in index.ts before
 * this config is passed to adapters, so it is not included here.
 */
export interface AdapterConfig<TPayload = unknown> {
  path: string;
  handler: Handler<TPayload> | null;
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

// ── Encrypted payload shape ───────────────────────────────────────────────────

/**
 * Payload received when the unisights SDK has encryption enabled.
 * Pass this to `decrypt()` to get back a `UnisightsPayload`.
 */
export interface EncryptedPayload {
  /** Base64-encoded XOR ciphertext */
  data: string;
  /** Base64-encoded HMAC-SHA256 authentication tag */
  tag: string;
  /** Key rotation bucket — floor(timestamp_ms / 30_000) */
  bucket: number;
  /** Your Unisights asset/property ID */
  site_id: string;
  /** SHA256 hash of the user-agent string */
  ua_hash: string;
  /** Always true when encrypted */
  encrypted: true;
}

/**
 * The raw body received by the server — either plain or encrypted.
 * Use `isEncrypted()` to narrow the type before processing.
 */
export type RawPayload = UnisightsPayload | EncryptedPayload;

// ── Decryption options ────────────────────────────────────────────────────────

export interface DecryptOptions {
  /**
   * Optional server-side secret for an extra HMAC wrapping layer.
   * When provided: server_key = HMAC(SERVER_SECRET, client_key)
   * Must match the secret used to configure the SDK if server-side wrapping is enabled.
   */
  serverSecret?: string;
}
