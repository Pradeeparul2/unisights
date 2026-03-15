import { init, getState, setPending } from "./init";
import { touchSession } from "./session";
import { sendAnalytics } from "./analytics";

export { init } from "./init";
export type {
  Unisights,
  UnisightsConfig,
  DeviceData,
  EventHandler,
} from "./types";

// ─── Browser bootstrap ────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.unisightsq ??= [];

  window.unisights = {
    init,

    log: (name, data) => {
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
      const { tracker, config } = getState();
      sendAnalytics(tracker, config, true);
    },

    registerEvent: (eventType, handler) => {
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
}

// At the bottom of your init.ts or index.ts
(function autoInit() {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>("script[data-insights-id]");

  if (!script) return;

  const endpoint = script.getAttribute("data-endpoint");
  const insightsId = script.getAttribute("data-insights-id");
  const debug = script.getAttribute("data-debug") === "true";

  if (endpoint && insightsId) {
    init({ endpoint, insightsId, debug });
  }
})();
