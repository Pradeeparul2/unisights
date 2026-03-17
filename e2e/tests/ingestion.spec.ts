import { test, expect } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";

const frameworks = [{ name: "express", port: 3001 }];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

frameworks.forEach(({ name, port }) => {
  test.describe.serial(`${name} ingestion`, () => {
    let server: ChildProcess;

    const endpoint = encodeURIComponent(
      `http://127.0.0.1:${port}/collect-${name}/event`,
    );

    const PAGE_PATH = `/?endpoint=${endpoint}`;

    async function getPayload(page: any, request: any) {
      await page.goto(PAGE_PATH);

      await page.waitForFunction(() => window.unisights !== undefined);

      await page.evaluate(() => {
        window.unisights.flushNow();
      });

      // Wait until backend receives payload
      await expect
        .poll(
          async () => {
            const res = await request.get(
              `http://127.0.0.1:${port}/test/events`,
            );
            const data = await res.json();
            return data;
          },
          { timeout: 10000 },
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
});
