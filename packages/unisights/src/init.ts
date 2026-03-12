import * as wasm from "@pradeeparul/unisights-core";
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
  return { tracker, config, pending, currentPageUrl, eventMap };
}

export function setPending(value: boolean): void {
  pending = value;
}

// ─── Config builder ───────────────────────────────────────────────────────────

function buildConfig(
  tag: Element,
  userConfig: Partial<UnisightsConfig>,
): UnisightsConfig {
  let tagConfig: Partial<UnisightsConfig> = {};
  try {
    tagConfig = JSON.parse(tag.getAttribute("data-analytics-config") ?? "{}");
  } catch {
    console.error("[Insights] Failed to parse data-analytics-config");
  }

  const id = tag.getAttribute("data-insights-id");
  if (!id) throw new Error("[Insights] Missing data-insights-id on script tag");

  return { ...defaultConfig, ...tagConfig, ...userConfig, insightsId: id };
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
  userConfig: Partial<UnisightsConfig> = {},
): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  if (IS_BOT) return;

  await loadWasm();

  const tag = document.querySelector("script[data-insights-id]");
  if (!tag)
    throw new Error("[Insights] Missing data-insights-id on script tag");

  config = buildConfig(tag, userConfig);
  eventMap = new Map();
  currentPageUrl = location.href;
  pending = false;

  tracker = createTracker(config, tag);

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
