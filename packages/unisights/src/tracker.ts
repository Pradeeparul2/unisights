import initWasm, * as wasm from "@pradeeparul2/unisights-core";
import wasmBinary from "@pradeeparul2/unisights-core/wasm";
import type { UnisightsConfig } from "./types";
import { FILE_DOWNLOAD_EXTENSIONS } from "./constants";
import { getOrCreateSession, touchSession } from "./session";
import { getDeviceInfo, getUTMParams } from "./device";
import { reportWebVitals } from "./analytics";

// ─── Wasm init ────────────────────────────────────────────────────────────────

export async function loadWasm(): Promise<void> {
  const binary = wasmBinary as unknown as Uint8Array;
  await initWasm(binary);
}

// ─── Tracker setup ────────────────────────────────────────────────────────────

export function createTracker(
  config: UnisightsConfig,
  tag: Element,
): wasm.Tracker {
  const tracker = new wasm.Tracker();
  const sessionId = getOrCreateSession();

  tracker.setEncryptionConfig(config.encrypt ?? false);

  tracker.setSessionInfo(
    config.insightsId!,
    sessionId,
    location.href,
    getUTMParams(),
    { ...getDeviceInfo(), referrer: document.referrer || "direct" } as any,
  );

  reportWebVitals(tracker, config);
  config.debug && console.log("[Insights] Initialized. Session:", sessionId);

  return tracker;
}

// ─── Page tracking ────────────────────────────────────────────────────────────

export function logPageEntry(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  tracker.logEntryPage(location.href);
  tracker.logPageView(location.href, document.title);
  config.debug && console.log("[Insights] Entry page:", location.href);
}

export function logPageView(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
  url: string,
): void {
  tracker.logPageView(url, document.title);
  config.debug && console.log("[Insights] Page view:", url);
  touchSession();
}

export function logPageExit(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
  url: string,
): void {
  tracker.logExitPage(url);
  config.debug && console.log("[Insights] Exit page:", url);
  touchSession();
}

// ─── Click tracking ───────────────────────────────────────────────────────────

export function setupClickTracking(
  tracker: wasm.Tracker,
  eventMap: Map<string, EventListener>,
): void {
  const handler = (e: MouseEvent) => {
    tracker.logClick(e.clientX, e.clientY);
    touchSession();
  };
  window.addEventListener("click", handler);
  eventMap.set("click", handler as EventListener);
}

export function setupRageClickTracking(tracker: wasm.Tracker): void {
  let clickCount = 0;
  let clickTimer: number;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener("click", (e: MouseEvent) => {
    const dx = Math.abs(e.clientX - lastX);
    const dy = Math.abs(e.clientY - lastY);

    // reset if moved too far — rage clicks are in same area
    if (dx > 30 || dy > 30) clickCount = 0;

    lastX = e.clientX;
    lastY = e.clientY;
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => {
      clickCount = 0;
    }, 500);

    if (clickCount >= 3) {
      tracker.logCustomEvent(
        "rage_click",
        JSON.stringify({
          x: e.clientX,
          y: e.clientY,
          count: clickCount,
          target: (e.target as Element)?.tagName?.toLowerCase(),
        }),
      );
      clickCount = 0;
    }
  });
}

export function setupDeadClickTracking(tracker: wasm.Tracker): void {
  // Interactive elements — clicks on these are NOT dead clicks
  const INTERACTIVE = new Set([
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    "details",
  ]);

  window.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as Element;
    if (!target) return;

    const tag = target.tagName.toLowerCase();
    const isInteractive =
      INTERACTIVE.has(tag) ||
      target.closest("a, button, [role='button'], [onclick], [tabindex]") !==
        null ||
      (target as HTMLElement).isContentEditable;

    if (!isInteractive) {
      tracker.logCustomEvent(
        "dead_click",
        JSON.stringify({
          x: e.clientX,
          y: e.clientY,
          tag,
          id: target.id || undefined,
          class: target.className || undefined,
        }),
      );
    }
  });
}

export function setupOutboundLinkTracking(tracker: wasm.Tracker): void {
  window.addEventListener("click", (e: MouseEvent) => {
    const a = (e.target as Element).closest("a") as HTMLAnchorElement | null;
    if (a?.hostname && a.hostname !== location.hostname) {
      tracker.logCustomEvent(
        "outbound_click",
        JSON.stringify({
          url: a.href,
          text: a.innerText?.trim().slice(0, 100),
        }),
      );
    }
  });
}

export function setupFileDownloadTracking(tracker: wasm.Tracker): void {
  window.addEventListener("click", (e: MouseEvent) => {
    const a = (e.target as Element).closest("a") as HTMLAnchorElement | null;
    if (a?.href && FILE_DOWNLOAD_EXTENSIONS.test(a.pathname)) {
      tracker.logCustomEvent(
        "file_download",
        JSON.stringify({
          url: a.href,
          filename: a.pathname.split("/").pop(),
        }),
      );
    }
  });
}

// ─── Scroll tracking ──────────────────────────────────────────────────────────

export function setupScrollTracking(
  tracker: wasm.Tracker,
  eventMap: Map<string, EventListener>,
): void {
  let lastScrollAt = 0;
  const handler = () => {
    const now = performance.now();
    if (now - lastScrollAt < 50) return;
    lastScrollAt = now;
    const percent =
      ((window.scrollY + window.innerHeight) /
        (document.body.scrollHeight || 1)) *
      100;
    tracker.updateScroll(percent);
    touchSession();
  };
  window.addEventListener("scroll", handler);
  eventMap.set("scroll", handler);
}

// ─── Copy / paste tracking ────────────────────────────────────────────────────

export function setupCopyPasteTracking(tracker: wasm.Tracker): void {
  document.addEventListener("copy", () => {
    const selected = window.getSelection()?.toString().trim();
    tracker.logCustomEvent(
      "copy",
      JSON.stringify({
        length: selected?.length ?? 0,
      }),
    );
  });

  document.addEventListener("paste", () => {
    tracker.logCustomEvent("paste", JSON.stringify({}));
  });
}

// ─── Error tracking ───────────────────────────────────────────────────────────

export function setupErrorTracking(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  window.addEventListener("error", (e: ErrorEvent) => {
    tracker.logCustomEvent(
      "js_error",
      JSON.stringify({
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        col: e.colno,
      }),
    );
    config.debug && console.log("[Insights] JS error captured:", e.message);
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    tracker.logCustomEvent(
      "unhandled_rejection",
      JSON.stringify({
        reason: String(e.reason),
      }),
    );
    config.debug &&
      console.log("[Insights] Unhandled rejection captured:", e.reason);
  });
}

// ─── Engagement time ──────────────────────────────────────────────────────────

export function setupEngagementTracking(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  let engagedMs = 0;
  let lastActiveAt = Date.now();
  let isActive = true;

  const IDLE_TIMEOUT = 30_000; // 30s idle = not engaged
  let idleTimer: number;

  const markActive = () => {
    if (!isActive) {
      isActive = true;
      lastActiveAt = Date.now();
    }
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (isActive) {
        engagedMs += Date.now() - lastActiveAt;
        isActive = false;
      }
    }, IDLE_TIMEOUT);
  };

  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, markActive, { passive: true });
  });

  // Flush engaged time on exit
  window.addEventListener("pagehide", () => {
    if (isActive) engagedMs += Date.now() - lastActiveAt;
    tracker.logCustomEvent(
      "engaged_time",
      JSON.stringify({
        ms: engagedMs,
        url: location.href,
      }),
    );
    config.debug && console.log("[Insights] Engaged time:", engagedMs, "ms");
  });
}

// ─── Tab focus / blur ─────────────────────────────────────────────────────────

export function setupTabFocusTracking(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  window.addEventListener("focus", () => {
    tracker.logCustomEvent("tab_focus", JSON.stringify({ url: location.href }));
    config.debug && console.log("[Insights] Tab focused");
  });

  window.addEventListener("blur", () => {
    tracker.logCustomEvent("tab_blur", JSON.stringify({ url: location.href }));
    config.debug && console.log("[Insights] Tab blurred");
  });
}

// ─── Network errors ───────────────────────────────────────────────────────────

export function setupNetworkErrorTracking(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  if (!("PerformanceObserver" in window)) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const r = entry as PerformanceResourceTiming;
      // transferSize = 0 and duration > 0 usually means a network error
      if (
        r.transferSize === 0 &&
        r.duration > 0 &&
        r.initiatorType === "fetch"
      ) {
        tracker.logCustomEvent(
          "network_error",
          JSON.stringify({
            url: r.name,
            duration: Math.round(r.duration),
          }),
        );
        config.debug && console.log("[Insights] Network error:", r.name);
      }
    }
  });

  observer.observe({ type: "resource", buffered: true });
}

// ─── Long tasks ───────────────────────────────────────────────────────────────

export function setupLongTaskTracking(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        tracker.logCustomEvent(
          "long_task",
          JSON.stringify({
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
          }),
        );
        config.debug &&
          console.log("[Insights] Long task:", entry.duration, "ms");
      }
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    // longtask not supported in all browsers — fail silently
  }
}

// ─── Resource timing ─────────────────────────────────────────────────────────

export function setupResourceTimingTracking(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  if (!("PerformanceObserver" in window)) return;

  const SLOW_THRESHOLD_MS = 1000;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const r = entry as PerformanceResourceTiming;
      if (r.duration > SLOW_THRESHOLD_MS) {
        tracker.logCustomEvent(
          "slow_resource",
          JSON.stringify({
            url: r.name,
            type: r.initiatorType,
            duration: Math.round(r.duration),
            size: r.transferSize,
          }),
        );
        config.debug &&
          console.log("[Insights] Slow resource:", r.name, r.duration, "ms");
      }
    }
  });

  observer.observe({ type: "resource", buffered: true });
}
