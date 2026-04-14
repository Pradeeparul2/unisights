import { test, expect } from "@playwright/test";
import { UUID_REGEX } from "../helpers/constants";
import { frameworks } from "../helpers/global-setup";

const frameworkName = process.env.FRAMEWORK_NAME!;
const framework = frameworks[frameworkName as keyof typeof frameworks];
const { namespace: name, port } = framework;

test.describe.serial(`${name} - Ingestion`, () => {
  const endpoint = encodeURIComponent(
    `http://127.0.0.1:${port}/collect-${name}/event`,
  );

  const PAGE_PATH = `/?endpoint=${endpoint}`;

  test.beforeEach(async ({ request }) => {
    await request.get(`http://127.0.0.1:${port}/test/clear`);
  });

  async function getPayload(page: any, request: any) {
    await page.goto(PAGE_PATH);
    await page.waitForFunction(() => window.unisights !== undefined);
    await page.waitForTimeout(300); // Wait for the library to initialize and send
    await page.evaluate(() => {
      window.unisights.flushNow();
    });

    await expect
      .poll(
        async () => {
          const res = await request.get(`http://127.0.0.1:${port}/test/events`);
          const data = await res.json();
          return data;
        },
        { timeout: 10000, intervals: [100, 200, 500] },
      )
      .toBeDefined();

    const res = await request.get(`http://127.0.0.1:${port}/test/events`);
    return res.json();
  }

  test("ingestion receives payload", async ({ page, request }) => {
    const response = await getPayload(page, request);
    expect(response).toBeDefined();
  });

  test("payload contains valid asset_id", async ({ page, request }) => {
    const response = await getPayload(page, request);
    expect(response.data.asset_id).toBe("e2e-test");
  });

  test("payload contains valid session_id", async ({ page, request }) => {
    const response = await getPayload(page, request);
    expect(response.data.session_id).toMatch(UUID_REGEX);
  });

  test("payload contains events array", async ({ page, request }) => {
    const response = await getPayload(page, request);
    expect(Array.isArray(response.data.events)).toBe(true);
  });

  test("payload contains device info", async ({ page, request }) => {
    const response = await getPayload(page, request);
    expect(response.data.device_info).toBeDefined();
  });

  test("payload encryption flag is false", async ({ page, request }) => {
    const response = await getPayload(page, request);
    expect(response.encrypted).toBe(false);
  });
});
