import { init, autoInit, getState, setPending, checkInitialized } from "./init";
import { touchSession } from "./session";
import { sendAnalytics } from "./analytics";

export { init } from "./init";
export type {
  Unisights,
  UnisightsConfig,
  DeviceData,
  EventHandler,
} from "./types";

if (typeof window !== "undefined") {
  window.unisightsq ??= [];

  window.unisights = {
    init,

    log: (name, data) => {
      if (!checkInitialized()) {
        console.error("[Insights] Not initialized. Call init() first.");
        return;
      }
      const { tracker } = getState();
      try {
        tracker.logCustomEvent(name, JSON.stringify(data));
        touchSession();
        setPending(true);
      } catch (e) {
        console.error("[Insights] log() error:", e);
      }
    },

    flushNow: () => {
      if (!checkInitialized()) {
        console.error("[Insights] Not initialized. Call init() first.");
        return;
      }
      const { tracker, config } = getState();
      sendAnalytics(tracker, config, true);
    },

    registerEvent: (eventType, handler) => {
      if (!checkInitialized()) {
        console.error("[Insights] Not initialized. Call init() first.");
        return () => {};
      }
      const { tracker, eventMap } = getState();
      const bound = typeof handler === "function" ? handler : () => {};
      window.addEventListener(eventType, bound);
      eventMap.set(eventType, bound as EventListener);
      return (name: string, data: unknown) => {
        try {
          tracker.logCustomEvent(name, JSON.stringify(data));
          setPending(true);
        } catch (e) {
          console.error("[Insights] Custom event error:", e);
        }
      };
    },
  };

  // Auto-init if data-attributes present
  (function () {
    const script =
      (document.currentScript as HTMLScriptElement | null) ??
      document.querySelector<HTMLScriptElement>("script[data-insights-id]");

    if (!script) return;

    const noAutoInit = script.getAttribute("data-no-auto-init") === "true";

    if (noAutoInit) {
      if (script.getAttribute("data-debug") === "true") {
        console.log("[Insights] Auto-init disabled. Call init() manually.");
      }
      return;
    }

    const endpoint = script.getAttribute("data-endpoint");
    const insightsId = script.getAttribute("data-insights-id");

    if (endpoint && insightsId) {
      autoInit(script).catch((err) => {
        console.error("[Insights] Auto-init failed:", err);
      });
    }
  })();
}
