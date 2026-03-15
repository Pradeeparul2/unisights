export type EventHandler =
  | ((event: Event) => void)
  | (() => (event: Event) => void);

export interface Unisights {
  init: (config?: Partial<UnisightsConfig>) => Promise<void>;
  registerEvent: (
    eventType: string,
    handler: EventHandler,
  ) => (name: string, data: unknown) => void;
  flushNow: () => void;
  log: (name: string, data: unknown) => void;
}

export interface DeviceData {
  user_agent: string;
  platform: string;
  os: string;
  screen_width: number;
  screen_height: number;
  device_type: string;
}

export interface UnisightsConfig {
  endpoint: string;
  insightsId?: string;
  debug?: boolean;
  encrypt?: boolean;
  flushIntervalMs?: number;
  // page
  trackPageViews?: boolean;
  // interactions
  trackClicks?: boolean;
  trackScroll?: boolean;
  trackRageClicks?: boolean;
  trackDeadClicks?: boolean;
  trackOutboundLinks?: boolean;
  trackFileDownloads?: boolean;
  trackCopyPaste?: boolean;
  // errors
  trackErrors?: boolean;
  // engagement
  trackEngagementTime?: boolean;
  trackTabFocus?: boolean;
  // network / performance
  trackNetworkErrors?: boolean;
  trackLongTasks?: boolean;
  trackResourceTiming?: boolean;
}

declare global {
  interface Window {
    unisights?: Unisights;
    unisightsq?: Array<() => void>;
  }
}
