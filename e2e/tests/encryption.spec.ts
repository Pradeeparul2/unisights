import { test, expect } from "@playwright/test";
import { frameworks } from "../helpers/constants";

frameworks.forEach(({ name, port }) => {
  test.describe.serial(`${name} - Encryption`, () => {
    test("payload encrypted when init with encrypt: true", async ({
      page,
      request,
    }) => {
      const endpoint = encodeURIComponent(
        `http://127.0.0.1:${port}/collect-${name}/event`,
      );

      await page.goto(`/?endpoint=${endpoint}&encrypt=true`);

      await page.waitForFunction(() => window.unisights !== undefined, {
        timeout: 5000,
      });

      await page.waitForTimeout(500);

      const initialized = await page.evaluate(() => {
        try {
          window.unisights.flushNow();
          return true;
        } catch (e) {
          console.error("Flush error:", e);
          return false;
        }
      });

      expect(initialized).toBe(true);

      await expect
        .poll(
          async () => {
            const res = await request.get(
              `http://127.0.0.1:${port}/test/events`,
            );
            return res.json();
          },
          { timeout: 10000 },
        )
        .not.toBeNull();

      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      expect(response.encrypted).toBe(true);
      expect(response.data.asset_id).toBe("e2e-test");
    });
  });
});
