import { vi } from "vitest";

// Mocks: import initWasm, * as wasm from "@pradeeparul2/unisights-core"

export const Tracker = vi.fn().mockImplementation(() => ({
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
  setSessionInfo: vi.fn(),
  tick: vi.fn(),
}));

export default vi.fn().mockResolvedValue(undefined); // initWasm
