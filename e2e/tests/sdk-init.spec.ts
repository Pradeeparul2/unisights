import { test, expect } from "@playwright/test";

test.describe("SDK Initialization", () => {
  test("SDK script loads successfully", async ({ page }) => {
    const responsePromise = page.waitForResponse((res) =>
      res.url().includes("index.global.js"),
    );

    await page.goto("/index.html");

    const response = await responsePromise;

    expect(response.status()).toBe(200);
  });

  test("SDK attaches global object to window", async ({ page }) => {
    await page.goto("/index.html");

    await page.waitForFunction(() => window.unisights !== undefined);

    const exists = await page.evaluate(() => {
      return typeof window.unisights !== "undefined";
    });

    expect(exists).toBe(true);
  });

  test("SDK exposes public API methods", async ({ page }) => {
    await page.goto("/index.html");

    const api = await page.evaluate(() => ({
      init: typeof window.unisights?.init,
      log: typeof window.unisights?.log,
      flushNow: typeof window.unisights?.flushNow,
      registerEvent: typeof window.unisights?.registerEvent,
    }));

    expect(api.init).toBe("function");
    expect(api.log).toBe("function");
    expect(api.flushNow).toBe("function");
    expect(api.registerEvent).toBe("function");
  });

  test("SDK initializes automatically via script tag", async ({ page }) => {
    await page.goto("/index.html");

    const initialized = await page.evaluate(() => {
      return !!window.unisights;
    });

    expect(initialized).toBeTruthy();
  });

  test("SDK reads configuration from script attributes", async ({ page }) => {
    await page.goto("/index.html");

    const config = await page.evaluate(() => {
      const tag = document.querySelector("script[data-insights-id]");
      return {
        insightsId: tag?.getAttribute("data-insights-id"),
        endpoint: tag?.getAttribute("data-endpoint"),
      };
    });

    expect(config.insightsId).toBe("e2e-test");
    expect(config.endpoint).toContain("collect-express");
  });

  test("SDK does not throw runtime errors during initialization", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/index.html");

    expect(errors.length).toBe(0);
  });

  test("SDK initializes only once", async ({ page }) => {
    await page.goto("/index.html");

    const result = await page.evaluate(() => {
      const first = window.unisights;
      const second = window.unisights;
      return first === second;
    });

    expect(result).toBe(true);
  });

  test("SDK queue processes calls before initialization", async ({ page }) => {
    await page.goto("/index.html");

    const result = await page.evaluate(() => {
      window.unisightsq = window.unisightsq || [];

      window.unisightsq.push(() => {
        //@ts-ignore
        window.__queueExecuted = true;
      });

      return true;
    });

    expect(result).toBe(true);
  });
});
