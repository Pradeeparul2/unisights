import { test, expect } from "@playwright/test";
import { frameworks } from "../helpers/constants";

frameworks.forEach(({ name, port }) => {
  test.describe.serial(`${name} - Page View Event`, () => {
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

    test("page_view event tracked automatically", async ({ page, request }) => {
      const response = await getPayload(page, request);
      const event = response.data.events.find(
        (e: any) => e.type === "page_view",
      );
      expect(event).toBeDefined();

      expect(event.data.location).toContain("localhost:3000");

      expect(event.data.title).toBeDefined();

      expect(typeof event.data.timestamp).toBe("number");
    });

    test("page_view event fires only once on initial load", async ({
      page,
      request,
    }) => {
      const response = await getPayload(page, request);

      const pageViews = response.data.events.filter(
        (e: any) => e.type === "page_view",
      );

      expect(pageViews.length).toBe(1);
    });

    test("page_view captures correct page URL", async ({ page, request }) => {
      const response = await getPayload(page, request);

      const event = response.data.events.find(
        (e: any) => e.type === "page_view",
      );

      expect(new URL(event.data.location).hostname).toBe("localhost");
    });

    test("page_view captures document title", async ({ page, request }) => {
      const response = await getPayload(page, request);

      const event = response.data.events.find(
        (e: any) => e.type === "page_view",
      );

      expect(event.data.title).toBe("Unisights Test Page");
    });

    test("page_view timestamp is recent", async ({ page, request }) => {
      const response = await getPayload(page, request);

      const event = response.data.events.find(
        (e: any) => e.type === "page_view",
      );

      const now = Date.now();

      expect(event.data.timestamp).toBeLessThanOrEqual(now);
      expect(event.data.timestamp).toBeGreaterThan(now - 60000);
    });
  });
});
