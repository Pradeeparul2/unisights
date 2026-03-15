import { expect } from "@playwright/test";

export function validatePayload(payload: any) {
  expect(payload).toHaveProperty("encrypted");
  expect(payload).toHaveProperty("data");

  const data = payload.data;

  expect(typeof payload.encrypted).toBe("boolean");

  expect(data).toHaveProperty("asset_id");
  expect(data).toHaveProperty("session_id");
  expect(data).toHaveProperty("page_url");
  expect(data).toHaveProperty("entry_page");

  expect(data).toHaveProperty("device_info");
  expect(data.device_info).toHaveProperty("browser");
  expect(data.device_info).toHaveProperty("os");

  expect(data).toHaveProperty("events");
  expect(Array.isArray(data.events)).toBe(true);
}
