import * as wasm from "@pradeeparul/unisights-core";
import {
  onCLS,
  onINP,
  onLCP,
  onFCP,
  onTTFB,
  Metric as WebVital,
} from "web-vitals";
import type { UnisightsConfig } from "./types";

export function deepConvertMap(obj: unknown): unknown {
  if (obj instanceof Map) {
    const result: Record<string, unknown> = {};
    obj.forEach((v, k) => {
      result[k] = deepConvertMap(v);
    });
    return result;
  }
  if (Array.isArray(obj)) return obj.map(deepConvertMap);
  return obj;
}

export function sendAnalytics(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
  final = false,
): void {
  try {
    const payload = tracker.exportEncryptedPayload();
    if (!payload || payload instanceof Error) return;
    config.debug && console.log("[Insights] Payload:", payload);

    const blob = new Blob([JSON.stringify(deepConvertMap(payload))], {
      type: "application/json",
    });
    const sent = navigator.sendBeacon(config.endpoint, blob);
    config.debug &&
      console.log("[Insights] Sent:", { success: sent, bytes: blob.size });
    if (sent) tracker.clearEvents();
  } catch (err) {
    config.debug && console.error("[Insights] Send error:", err);
  }
}

export function reportWebVitals(
  tracker: wasm.Tracker,
  config: UnisightsConfig,
): void {
  const report = (metric: WebVital) => {
    try {
      tracker.logWebVital(
        metric.name,
        metric.value,
        metric.id,
        metric.rating,
        metric.delta,
        metric.entries?.length ?? 0,
        metric.navigationType ?? "navigate",
      );
      config.debug && console.log("[Insights] Web Vital:", metric);
    } catch (e) {
      console.error("[Insights] Web Vital error:", e);
    }
  };
  [onCLS, onINP, onLCP, onFCP, onTTFB].forEach((fn) => fn(report));
}
