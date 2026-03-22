import * as wasm from "@pradeeparul2/unisights-core";
import type { UnisightsConfig } from "./types";
import { defaultConfig, IS_BOT } from "./constants";
import {
  loadWasm,
  createTracker,
  logPageEntry,
  logPageView,
  logPageExit,
  setupClickTracking,
  setupRageClickTracking,
  setupDeadClickTracking,
  setupOutboundLinkTracking,
  setupFileDownloadTracking,
  setupScrollTracking,
  setupCopyPasteTracking,
  setupErrorTracking,
  setupEngagementTracking,
  setupTabFocusTracking,
  setupNetworkErrorTracking,
  setupLongTaskTracking,
  setupResourceTimingTracking,
} from "./tracker";
import { setupNavigation, setupExitTracking } from "./navigation";
import { sendAnalytics } from "./analytics";

// ─── Module state ─────────────────────────────────────────────────────────────

let isInitialized = false;
let tracker: wasm.Tracker;
let config: UnisightsConfig;
let pending = false;
let currentPageUrl = "";
let eventMap: Map<string, EventListener>;

export function getState() {
  if (!isInitialized) {
    throw new Error("[Insights] Not initialized. Call init() first.");
  }
  return { tracker, config, pending, currentPageUrl, eventMap };
}

export function setPending(value: boolean): void {
  pending = value;
}

export function checkInitialized(): boolean {
  return isInitialized;
}

// ─── Config builder ───────────────────────────────────────────────────────────

function parseDataAttribute(
  value: string | null,
): boolean | string | number | null {
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!isNaN(num)) return num;
  return value;
}

function buildConfigFromScriptTag(
  scriptTag: HTMLScriptElement,
  userConfig: Partial<UnisightsConfig> = {},
): UnisightsConfig {
  const endpoint = scriptTag.getAttribute("data-endpoint");
  const insightsId = scriptTag.getAttribute("data-insights-id");

  if (!endpoint || !insightsId) {
    throw new Error("[Insights] data-endpoint and data-insights-id required");
  }

  const tagConfig: Partial<UnisightsConfig> = {
    endpoint,
    insightsId,
  };

  // Boolean flags
  const booleanAttrs = [
    "debug",
    "encrypt",
    "trackPageViews",
    "trackClicks",
    "trackScroll",
    "trackErrors",
    "trackRageClicks",
    "trackDeadClicks",
    "trackOutboundLinks",
    "trackFileDownloads",
    "trackCopyPaste",
    "trackEngagementTime",
    "trackTabFocus",
    "trackNetworkErrors",
    "trackLongTasks",
    "trackResourceTiming",
  ];

  booleanAttrs.forEach((attr) => {
    const value = scriptTag.getAttribute(
      `data-${attr.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`,
    );
    if (value !== null) {
      tagConfig[attr as keyof UnisightsConfig] = parseDataAttribute(
        value,
      ) as any;
    }
  });

  // Numeric configs
  const flushInterval = scriptTag.getAttribute("data-flush-interval-ms");
  if (flushInterval) {
    tagConfig.flushIntervalMs = Number(flushInterval);
  }

  return { ...defaultConfig, ...tagConfig, ...userConfig };
}

function buildConfig(userConfig: Partial<UnisightsConfig>): UnisightsConfig {
  if (!userConfig.endpoint || !userConfig.insightsId) {
    throw new Error("[Insights] endpoint and insightsId are required");
  }
  return { ...defaultConfig, ...userConfig } as UnisightsConfig;
}

// ─── Flush interval ───────────────────────────────────────────────────────────

function startFlushInterval(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  let start = performance.now();
  window.setInterval(() => {
    const now = performance.now();
    tracker.tick((now - start) / 1000);
    start = now;
    if (pending) {
      sendAnalytics(tracker, config);
      pending = false;
    }
  }, config.flushIntervalMs);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function init(
  userConfig?: Partial<UnisightsConfig>,
): Promise<void> {
  if (isInitialized) {
    console.warn("[Insights] Already initialized");
    return;
  }

  if (IS_BOT) {
    console.log("[Insights] Bot detected, skipping initialization");
    return;
  }

  if (!userConfig) {
    throw new Error("[Insights] Configuration required");
  }

  await loadWasm();

  config = buildConfig(userConfig);
  eventMap = new Map();
  currentPageUrl = location.href;
  pending = false;

  tracker = createTracker(config);

  isInitialized = true;

  // ── Page views ──────────────────────────────────────────────────────────────
  if (config.trackPageViews) {
    logPageEntry(tracker, config);
    pending = true;
  }

  // ── Click interactions ──────────────────────────────────────────────────────
  if (config.trackClicks) setupClickTracking(tracker, eventMap);
  if (config.trackRageClicks) setupRageClickTracking(tracker);
  if (config.trackDeadClicks) setupDeadClickTracking(tracker);
  if (config.trackOutboundLinks) setupOutboundLinkTracking(tracker);
  if (config.trackFileDownloads) setupFileDownloadTracking(tracker);

  // ── Scroll ──────────────────────────────────────────────────────────────────
  if (config.trackScroll) setupScrollTracking(tracker, eventMap);

  // ── Content engagement ──────────────────────────────────────────────────────
  if (config.trackCopyPaste) setupCopyPasteTracking(tracker);

  // ── Errors ──────────────────────────────────────────────────────────────────
  if (config.trackErrors) setupErrorTracking(tracker, config);

  // ── Engagement & focus ──────────────────────────────────────────────────────
  if (config.trackEngagementTime) setupEngagementTracking(tracker, config);
  if (config.trackTabFocus) setupTabFocusTracking(tracker, config);

  // ── Performance ─────────────────────────────────────────────────────────────
  if (config.trackNetworkErrors) setupNetworkErrorTracking(tracker, config);
  if (config.trackLongTasks) setupLongTaskTracking(tracker, config);
  if (config.trackResourceTiming) setupResourceTimingTracking(tracker, config);

  // ── SPA navigation ──────────────────────────────────────────────────────────
  setupNavigation((newUrl) => {
    if (newUrl === currentPageUrl) return;
    if (pending) {
      sendAnalytics(tracker, config);
      pending = false;
    }
    currentPageUrl = newUrl;
    if (config.trackPageViews) {
      logPageView(tracker, config, currentPageUrl);
      pending = true;
    }
  });

  // ── Exit tracking ───────────────────────────────────────────────────────────
  setupExitTracking(() => {
    logPageExit(tracker, config, currentPageUrl);
    sendAnalytics(tracker, config, true);
    pending = false;
  });

  // ── Flush interval ──────────────────────────────────────────────────────────
  startFlushInterval(tracker, config);

  // ── Drain pre-init queue ────────────────────────────────────────────────────
  window.unisightsq?.splice(0).forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("[Insights] Queue error:", e);
    }
  });
}

export async function autoInit(scriptTag: HTMLScriptElement): Promise<void> {
  const config = buildConfigFromScriptTag(scriptTag);
  await init(config);
}

export { buildConfigFromScriptTag };
