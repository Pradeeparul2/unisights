import type { DeviceData } from "./types";

export function getUTMParams(): Record<string, string> {
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];
  const params: Record<string, string> = {};
  const search = new URLSearchParams(window.location.search);

  for (const key of keys) {
    const value = search.get(key) ?? sessionStorage.getItem(`_us_${key}`);
    if (value) {
      params[key] = value;
      sessionStorage.setItem(`_us_${key}`, value);
    }
  }
  return params;
}

export function getDeviceInfo(): DeviceData {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const os = /Win/.test(platform)
    ? "Windows"
    : /Mac/.test(platform)
      ? "macOS"
      : /Linux/.test(platform)
        ? "Linux"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad|iPod/.test(ua)
            ? "iOS"
            : "Unknown";

  return {
    userAgent: ua,
    platform,
    os,
    screenWidth: screen.width,
    screenHeight: screen.height,
    deviceType: /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop",
  };
}
