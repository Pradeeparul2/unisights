import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTracker = {
  logWebVital: vi.fn(),
  logClick: vi.fn(),
  updateScroll: vi.fn(),
  logEntryPage: vi.fn(),
  logPageView: vi.fn(),
  logExitPage: vi.fn(),
  logCustomEvent: vi.fn(),
  exportEncryptedPayload: vi.fn(() => ({ events: [] })),
  clearEvents: vi.fn(),
  setEncryptionKey: vi.fn(),
  setEncryptionConfig: vi.fn(),
  setSessionInfo: vi.fn(),
  tick: vi.fn(),
};

let trackerInstanceCount = 0;

class MockTracker {
  constructor() {
    trackerInstanceCount++;
  }
  logWebVital = mockTracker.logWebVital;
  logClick = mockTracker.logClick;
  updateScroll = mockTracker.updateScroll;
  logEntryPage = mockTracker.logEntryPage;
  logPageView = mockTracker.logPageView;
  logExitPage = mockTracker.logExitPage;
  logCustomEvent = mockTracker.logCustomEvent;
  exportEncryptedPayload = mockTracker.exportEncryptedPayload;
  clearEvents = mockTracker.clearEvents;
  setEncryptionKey = mockTracker.setEncryptionKey;
  setEncryptionConfig = mockTracker.setEncryptionConfig;
  setSessionInfo = mockTracker.setSessionInfo;
  tick = mockTracker.tick;
}

vi.mock("@pradeeparul2/unisights-core", () => ({
  default: vi.fn().mockResolvedValue(undefined),
  Tracker: MockTracker,
}));

vi.mock("web-vitals", () => ({
  onCLS: vi.fn((cb) =>
    cb({
      name: "CLS",
      value: 0.1,
      id: "v1",
      rating: "good",
      delta: 0.1,
      entries: [],
      navigationType: "navigate",
    }),
  ),
  onINP: vi.fn((cb) =>
    cb({
      name: "INP",
      value: 100,
      id: "v2",
      rating: "good",
      delta: 100,
      entries: [],
      navigationType: "navigate",
    }),
  ),
  onLCP: vi.fn((cb) =>
    cb({
      name: "LCP",
      value: 1200,
      id: "v3",
      rating: "good",
      delta: 1200,
      entries: [],
      navigationType: "navigate",
    }),
  ),
  onFCP: vi.fn((cb) =>
    cb({
      name: "FCP",
      value: 800,
      id: "v4",
      rating: "good",
      delta: 800,
      entries: [],
      navigationType: "navigate",
    }),
  ),
  onTTFB: vi.fn((cb) =>
    cb({
      name: "TTFB",
      value: 200,
      id: "v5",
      rating: "good",
      delta: 200,
      entries: [],
      navigationType: "navigate",
    }),
  ),
}));

// ── Browser API stubs ─────────────────────────────────────────────────────────

const mockSendBeacon = vi.fn(() => true);

function setupDOM(insightsId = "test-id") {
  document.body.innerHTML = `
    <script
      data-insights-id="${insightsId}"
    ></script>
  `;
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules();

  trackerInstanceCount = 0;
  Object.values(mockTracker).forEach((fn) => fn.mockReset());
  mockTracker.exportEncryptedPayload.mockReturnValue({ events: [] });
  mockSendBeacon.mockReset();
  mockSendBeacon.mockReturnValue(true);

  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      href: "http://localhost/",
      search: "",
      hostname: "localhost",
      pathname: "/",
    },
  });
  Object.defineProperty(navigator, "userAgent", {
    writable: true,
    value: "Mozilla/5.0 (Test)",
  });
  Object.defineProperty(navigator, "platform", {
    writable: true,
    value: "Win32",
  });
  Object.defineProperty(navigator, "sendBeacon", {
    writable: true,
    value: mockSendBeacon,
  });
  Object.defineProperty(screen, "width", { writable: true, value: 1920 });
  Object.defineProperty(screen, "height", { writable: true, value: 1080 });
  Object.defineProperty(document, "visibilityState", {
    writable: true,
    value: "visible",
  });
  Object.defineProperty(document, "referrer", { writable: true, value: "" });

  localStorage.clear();
  sessionStorage.clear();

  delete window.unisights;
  delete window.unisightsq;

  setupDOM();
});

const addedListeners: Array<{
  target: EventTarget;
  type: string;
  fn: EventListenerOrEventListenerObject;
}> = [];

const _origWindowAdd = window.addEventListener.bind(window);
window.addEventListener = (type: string, fn: any, ...rest: any[]) => {
  addedListeners.push({ target: window, type, fn });
  _origWindowAdd(type, fn, ...rest);
};

const _origDocAdd = document.addEventListener.bind(document);
document.addEventListener = (type: string, fn: any, ...rest: any[]) => {
  addedListeners.push({ target: document, type, fn });
  _origDocAdd(type, fn, ...rest);
};

afterEach(() => {
  vi.useRealTimers();
  addedListeners.forEach(({ target, type, fn }) =>
    target.removeEventListener(type, fn),
  );
  addedListeners.length = 0;
});

async function importAnalytics() {
  return await import("../src/index");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("init()", () => {
  it("initializes successfully with valid config", async () => {
    const { init } = await importAnalytics();
    await expect(
      init({ endpoint: "https://api.example.com/events" }),
    ).resolves.toBeUndefined();
  });

  it("throws if data-insights-id is missing", async () => {
    document.body.innerHTML = `<script></script>`;
    const { init } = await importAnalytics();
    await expect(init({ endpoint: "https://api.example.com" })).rejects.toThrow(
      "Missing data-insights-id",
    );
  });

  it("is idempotent — calling init() twice instantiates Tracker only once", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    await init({ endpoint: "https://api.example.com" });
    expect(trackerInstanceCount).toBe(1);
  });

  it("skips initialization for bots", async () => {
    Object.defineProperty(navigator, "userAgent", {
      writable: true,
      value: "Googlebot/2.1 (+http://www.google.com/bot.html)",
    });
    vi.resetModules();
    trackerInstanceCount = 0;
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    expect(trackerInstanceCount).toBe(0);
  });

  it("sets encryption key when secret and salt are present", async () => {
    setupDOM("test-id", true);
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", encrypt: true });
    expect(mockTracker.setEncryptionConfig).toHaveBeenCalledWith(true);
  });

  it("disables encryption when encrypt is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", encrypt: false });
    expect(mockTracker.setEncryptionConfig).toHaveBeenCalledWith(false);
  });
});

// ── Session ───────────────────────────────────────────────────────────────────

describe("session management", () => {
  it("creates a new session if none exists", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    const stored = localStorage.getItem("__ua_session");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).sessionId).toBeTruthy();
  });

  it("reuses an existing active session", async () => {
    const existing = {
      sessionId: "existing-session-id",
      startedAt: Date.now(),
      lastActivity: Date.now(),
    };
    localStorage.setItem("__ua_session", JSON.stringify(existing));

    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });

    expect(mockTracker.setSessionInfo).toHaveBeenCalledWith(
      expect.anything(),
      "existing-session-id",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("creates a new session if existing session has expired", async () => {
    const expired = {
      sessionId: "old-session-id",
      startedAt: Date.now() - 40 * 60 * 1000,
      lastActivity: Date.now() - 40 * 60 * 1000,
    };
    localStorage.setItem("__ua_session", JSON.stringify(expired));

    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });

    expect(mockTracker.setSessionInfo).not.toHaveBeenCalledWith(
      expect.anything(),
      "old-session-id",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});

// ── Page views ────────────────────────────────────────────────────────────────

describe("page view tracking", () => {
  it("logs entry page and page view on init", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackPageViews: true });
    expect(mockTracker.logEntryPage).toHaveBeenCalledWith("http://localhost/");
    expect(mockTracker.logPageView).toHaveBeenCalledWith(
      "http://localhost/",
      expect.any(String),
    );
  });

  it("does not log page view when trackPageViews is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackPageViews: false });
    expect(mockTracker.logEntryPage).not.toHaveBeenCalled();
    expect(mockTracker.logPageView).not.toHaveBeenCalled();
  });
});

// ── Clicks ────────────────────────────────────────────────────────────────────

describe("click tracking", () => {
  it("logs click events when trackClicks is true", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackClicks: true });
    window.dispatchEvent(
      new MouseEvent("click", { clientX: 100, clientY: 200 }),
    );
    expect(mockTracker.logClick).toHaveBeenCalledWith(100, 200);
  });

  it("does not log clicks when trackClicks is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackClicks: false });
    mockTracker.logClick.mockReset();
    window.dispatchEvent(
      new MouseEvent("click", { clientX: 100, clientY: 200 }),
    );
    expect(mockTracker.logClick).not.toHaveBeenCalled();
  });
});

// ── Rage clicks ───────────────────────────────────────────────────────────────

describe("rage click tracking", () => {
  it("logs rage_click after 3 rapid clicks in same area", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackRageClicks: true });
    mockTracker.logCustomEvent.mockReset();

    for (let i = 0; i < 3; i++) {
      window.dispatchEvent(
        new MouseEvent("click", { clientX: 50, clientY: 50 }),
      );
    }

    const rageCalls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "rage_click",
    );
    expect(rageCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not log rage_click when trackRageClicks is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackRageClicks: false });
    mockTracker.logCustomEvent.mockReset();

    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(
        new MouseEvent("click", { clientX: 50, clientY: 50 }),
      );
    }

    const rageCalls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "rage_click",
    );
    expect(rageCalls.length).toBe(0);
  });
});

// ── Dead clicks ───────────────────────────────────────────────────────────────

describe("dead click tracking", () => {
  it("logs dead_click when clicking a non-interactive element", async () => {
    document.body.innerHTML += `<div id="non-interactive">text</div>`;
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackDeadClicks: true });
    mockTracker.logCustomEvent.mockReset();

    const div = document.getElementById("non-interactive")!;
    div.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }),
    );

    const deadCalls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "dead_click",
    );
    expect(deadCalls.length).toBe(1);
  });

  it("does not log dead_click when clicking a button", async () => {
    document.body.innerHTML += `<button id="btn">Click</button>`;
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackDeadClicks: true });
    mockTracker.logCustomEvent.mockReset();

    const btn = document.getElementById("btn")!;
    btn.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 }),
    );

    const deadCalls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "dead_click",
    );
    expect(deadCalls.length).toBe(0);
  });
});

// ── Outbound links ────────────────────────────────────────────────────────────

describe("outbound link tracking", () => {
  it("logs outbound_click when clicking an external link", async () => {
    document.body.innerHTML += `<a id="ext" href="https://external.com">External</a>`;
    const { init } = await importAnalytics();
    await init({
      endpoint: "https://api.example.com",
      trackOutboundLinks: true,
    });
    mockTracker.logCustomEvent.mockReset();

    const a = document.getElementById("ext")!;
    a.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "outbound_click",
    );
    expect(calls.length).toBe(1);
    expect(JSON.parse(calls[0][1]).url).toMatch(/^https:\/\/external\.com/);
  });

  it("does not log outbound_click for internal links", async () => {
    document.body.innerHTML += `<a id="int" href="http://localhost/about">Internal</a>`;
    const { init } = await importAnalytics();
    await init({
      endpoint: "https://api.example.com",
      trackOutboundLinks: true,
    });
    mockTracker.logCustomEvent.mockReset();

    const a = document.getElementById("int")!;
    a.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "outbound_click",
    );
    expect(calls.length).toBe(0);
  });
});

// ── File downloads ────────────────────────────────────────────────────────────

describe("file download tracking", () => {
  it("logs file_download when clicking a download link", async () => {
    document.body.innerHTML += `<a id="dl" href="http://localhost/report.pdf">Download</a>`;
    const { init } = await importAnalytics();
    await init({
      endpoint: "https://api.example.com",
      trackFileDownloads: true,
    });
    mockTracker.logCustomEvent.mockReset();

    const a = document.getElementById("dl")!;
    a.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "file_download",
    );
    expect(calls.length).toBe(1);
    expect(JSON.parse(calls[0][1])).toMatchObject({ filename: "report.pdf" });
  });

  it("does not log file_download for regular links", async () => {
    document.body.innerHTML += `<a id="page" href="http://localhost/about">About</a>`;
    const { init } = await importAnalytics();
    await init({
      endpoint: "https://api.example.com",
      trackFileDownloads: true,
    });
    mockTracker.logCustomEvent.mockReset();

    const a = document.getElementById("page")!;
    a.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "file_download",
    );
    expect(calls.length).toBe(0);
  });
});

// ── Scroll ────────────────────────────────────────────────────────────────────

describe("scroll tracking", () => {
  it("logs scroll when trackScroll is true", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackScroll: true });

    Object.defineProperty(window, "scrollY", { writable: true, value: 500 });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      value: 800,
    });
    Object.defineProperty(document.body, "scrollHeight", {
      writable: true,
      value: 2000,
    });

    window.dispatchEvent(new Event("scroll"));
    expect(mockTracker.updateScroll).toHaveBeenCalled();
  });

  it("does not track scroll when trackScroll is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackScroll: false });
    window.dispatchEvent(new Event("scroll"));
    expect(mockTracker.updateScroll).not.toHaveBeenCalled();
  });
});

// ── Copy / paste ──────────────────────────────────────────────────────────────

describe("copy/paste tracking", () => {
  it("logs copy event when trackCopyPaste is true", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackCopyPaste: true });
    mockTracker.logCustomEvent.mockReset();

    document.dispatchEvent(new Event("copy"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "copy",
    );
    expect(calls.length).toBe(1);
  });

  it("logs paste event when trackCopyPaste is true", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackCopyPaste: true });
    mockTracker.logCustomEvent.mockReset();

    document.dispatchEvent(new Event("paste"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "paste",
    );
    expect(calls.length).toBe(1);
  });

  it("does not log copy/paste when trackCopyPaste is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackCopyPaste: false });
    mockTracker.logCustomEvent.mockReset();

    document.dispatchEvent(new Event("copy"));
    document.dispatchEvent(new Event("paste"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "copy" || name === "paste",
    );
    expect(calls.length).toBe(0);
  });
});

// ── Error tracking ────────────────────────────────────────────────────────────

describe("error tracking", () => {
  it("logs js_error on window error event", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackErrors: true });
    mockTracker.logCustomEvent.mockReset();

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Something went wrong",
        filename: "app.js",
        lineno: 42,
        colno: 10,
      }),
    );

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "js_error",
    );
    expect(calls.length).toBe(1);
    expect(JSON.parse(calls[0][1])).toMatchObject({
      message: "Something went wrong",
      line: 42,
    });
  });

  it("logs unhandled_rejection on promise rejection", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackErrors: true });
    mockTracker.logCustomEvent.mockReset();

    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: "Network timeout",
      }),
    );

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "unhandled_rejection",
    );
    expect(calls.length).toBe(1);
    expect(JSON.parse(calls[0][1])).toMatchObject({
      reason: "Network timeout",
    });
  });

  it("does not track errors when trackErrors is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackErrors: false });
    mockTracker.logCustomEvent.mockReset();

    window.dispatchEvent(new ErrorEvent("error", { message: "oops" }));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "js_error",
    );
    expect(calls.length).toBe(0);
  });
});

// ── Tab focus ─────────────────────────────────────────────────────────────────

describe("tab focus tracking", () => {
  it("logs tab_focus on window focus", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackTabFocus: true });
    mockTracker.logCustomEvent.mockReset();

    window.dispatchEvent(new Event("focus"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "tab_focus",
    );
    expect(calls.length).toBe(1);
  });

  it("logs tab_blur on window blur", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackTabFocus: true });
    mockTracker.logCustomEvent.mockReset();

    window.dispatchEvent(new Event("blur"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "tab_blur",
    );
    expect(calls.length).toBe(1);
  });

  it("does not track focus/blur when trackTabFocus is false", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", trackTabFocus: false });
    mockTracker.logCustomEvent.mockReset();

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("blur"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "tab_focus" || name === "tab_blur",
    );
    expect(calls.length).toBe(0);
  });
});

// ── Engagement time ───────────────────────────────────────────────────────────

describe("engagement time tracking", () => {
  it("logs engaged_time on pagehide when trackEngagementTime is true", async () => {
    const { init } = await importAnalytics();
    await init({
      endpoint: "https://api.example.com",
      trackEngagementTime: true,
    });

    window.dispatchEvent(new MouseEvent("click", { clientX: 0, clientY: 0 }));
    window.dispatchEvent(new Event("pagehide"));

    const calls = mockTracker.logCustomEvent.mock.calls.filter(
      ([name]) => name === "engaged_time",
    );
    expect(calls.length).toBe(1);
    const payload = JSON.parse(calls[0][1]);
    expect(payload).toHaveProperty("ms");
    expect(payload).toHaveProperty("url");
  });
});

// ── Referrer ──────────────────────────────────────────────────────────────────

describe("referrer tracking", () => {
  it("includes referrer in session info", async () => {
    Object.defineProperty(document, "referrer", {
      writable: true,
      value: "https://google.com",
    });

    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });

    expect(mockTracker.setSessionInfo).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ referrer: "https://google.com" }),
    );
  });

  it('uses "direct" when referrer is empty', async () => {
    Object.defineProperty(document, "referrer", { writable: true, value: "" });

    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });

    expect(mockTracker.setSessionInfo).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ referrer: "direct" }),
    );
  });
});

// ── Web vitals ────────────────────────────────────────────────────────────────

describe("web vitals", () => {
  it("logs all 5 web vitals on init", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    expect(mockTracker.logWebVital).toHaveBeenCalledTimes(5);
  });

  it("logs correct metric names", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    const names = mockTracker.logWebVital.mock.calls.map((c) => c[0]);
    expect(names).toEqual(
      expect.arrayContaining(["CLS", "INP", "LCP", "FCP", "TTFB"]),
    );
  });
});

// ── sendAnalytics / flushNow ──────────────────────────────────────────────────

describe("sendAnalytics / flushNow", () => {
  it("calls sendBeacon with payload", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    window.unisights!.flushNow();
    expect(mockSendBeacon).toHaveBeenCalledWith(
      "https://api.example.com",
      expect.any(Blob),
    );
  });

  it("calls tracker.clearEvents after successful beacon", async () => {
    mockSendBeacon.mockReturnValue(true);
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    window.unisights!.flushNow();
    expect(mockTracker.clearEvents).toHaveBeenCalled();
  });

  it("does not clear events if sendBeacon fails", async () => {
    mockSendBeacon.mockReturnValue(false);
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    mockTracker.clearEvents.mockReset();
    window.unisights!.flushNow();
    expect(mockTracker.clearEvents).not.toHaveBeenCalled();
  });

  it("does not send if payload is null", async () => {
    mockTracker.exportEncryptedPayload.mockReturnValueOnce(null);
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    mockSendBeacon.mockReset();
    window.unisights!.flushNow();
    expect(mockSendBeacon).not.toHaveBeenCalled();
  });
});

// ── window.unisights ──────────────────────────────────────────────────────────

describe("window.unisights", () => {
  it("exposes init, log, flushNow, registerEvent on window", async () => {
    await importAnalytics();
    expect(window.unisights).toBeDefined();
    expect(window.unisights!.init).toBeTypeOf("function");
    expect(window.unisights!.log).toBeTypeOf("function");
    expect(window.unisights!.flushNow).toBeTypeOf("function");
    expect(window.unisights!.registerEvent).toBeTypeOf("function");
  });

  it("log() calls tracker.logCustomEvent", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    window.unisights!.log("button_click", { id: "cta" });
    expect(mockTracker.logCustomEvent).toHaveBeenCalledWith(
      "button_click",
      JSON.stringify({ id: "cta" }),
    );
  });

  it("registerEvent() attaches a window event listener", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    const handler = vi.fn();
    window.unisights!.registerEvent("mousemove", handler);
    window.dispatchEvent(new Event("mousemove"));
    expect(handler).toHaveBeenCalled();
  });
});

// ── UTM params ────────────────────────────────────────────────────────────────

describe("UTM params", () => {
  it("reads UTM params from URL and stores in sessionStorage", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        href: "http://localhost/?utm_source=google&utm_medium=cpc",
        search: "?utm_source=google&utm_medium=cpc",
        hostname: "localhost",
      },
    });

    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });

    expect(mockTracker.setSessionInfo).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ utm_source: "google", utm_medium: "cpc" }),
      expect.anything(),
    );
  });
});

// ── pagehide / visibilitychange ───────────────────────────────────────────────

describe("pagehide / visibilitychange", () => {
  it("flushes on pagehide", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    window.dispatchEvent(new Event("pagehide"));
    expect(mockTracker.logExitPage).toHaveBeenCalled();
    expect(mockSendBeacon).toHaveBeenCalled();
  });

  it("flushes when tab is hidden", async () => {
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockSendBeacon).toHaveBeenCalled();
  });
});

// ── Flush interval ────────────────────────────────────────────────────────────

describe("flush interval", () => {
  it("calls tick and flushes on interval", async () => {
    vi.useFakeTimers();
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com", flushIntervalMs: 1000 });
    window.dispatchEvent(new MouseEvent("click", { clientX: 0, clientY: 0 }));
    vi.advanceTimersByTime(1000);
    expect(mockTracker.tick).toHaveBeenCalled();
    expect(mockSendBeacon).toHaveBeenCalled();
  });
});

// ── Pre-init queue ────────────────────────────────────────────────────────────

describe("unisightsq queue", () => {
  it("drains queued functions after init", async () => {
    const queued = vi.fn();
    window.unisightsq = [queued];
    const { init } = await importAnalytics();
    await init({ endpoint: "https://api.example.com" });
    expect(queued).toHaveBeenCalled();
    expect(window.unisightsq!.length).toBe(0);
  });
});
