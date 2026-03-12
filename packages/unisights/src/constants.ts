import type { UnisightsConfig } from "./types";

export const SESSION_KEY = "__ua_session";
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export const IS_BOT = /bot|crawler|spider|crawling/i.test(navigator.userAgent);

export const FILE_DOWNLOAD_EXTENSIONS =
  /\.(pdf|zip|xlsx?|docx?|pptx?|csv|mp4|mp3|dmg|exe|pkg)$/i;

export const defaultConfig: UnisightsConfig = {
  endpoint: "",
  debug: false,
  encrypt: false,
  flushIntervalMs: 15_000,
  // page
  trackPageViews: true,
  // interactions
  trackClicks: true,
  trackScroll: true,
  trackRageClicks: true,
  trackDeadClicks: true,
  trackOutboundLinks: true,
  trackFileDownloads: true,
  trackCopyPaste: false,
  // errors
  trackErrors: true,
  // engagement
  trackEngagementTime: true,
  trackTabFocus: true,
  // network / performance
  trackNetworkErrors: false,
  trackLongTasks: false,
  trackResourceTiming: false,
};
