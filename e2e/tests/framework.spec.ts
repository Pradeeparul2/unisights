import { test, expect } from "@playwright/test";
import { spawn } from "child_process";

const frameworks = [{ name: "express", port: 3001 }];

frameworks.forEach(({ name, port }) => {
  test.describe(`${name} framework`, () => {
    let server: any;

    test.beforeAll(async () => {
      server = spawn("node", ["frameworks/express.ts"], {
        stdio: "inherit",
      });

      // give server time to start
      await new Promise((r) => setTimeout(r, 2000));
    });

    test.afterAll(() => {
      server.kill();
    });

    test("express receives valid payload", async ({ page }) => {
      await page.goto(
        `/index.html?endpoint=http://localhost:${port}/collect-${name}/event`,
      );

      // wait for SDK initialization
      //@ts-ignore
      await page.waitForFunction(() => window.unisights !== undefined);

      // click event
      await page.click("#btn");

      // force flush events
      //@ts-ignore
      await page.evaluate(() => window.unisights.flushNow());

      await expect
        .poll(
          async () => {
            const payloads = await fetch(
              `http://localhost:${port}/test/events`,
            ).then((r) => r.json());

            return payloads.length;
          },
          { timeout: 10000 },
        )
        .toBeGreaterThan(0);
    });
  });
});
