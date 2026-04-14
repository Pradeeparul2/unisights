import { test, expect } from "@playwright/test";
import { frameworks } from "../helpers/constants";

frameworks.forEach(({ name, port }) => {
  test.describe.serial(`${name} - Events`, () => {
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
      await page.waitForTimeout(300);
      await page.evaluate(() => window.unisights.flushNow());
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
      return res.json();
    }

    // ── Page Events ──────────────────────────────────────────────────────────

    test("entry_page is tracked", async ({ page, request }) => {
      const response = await getPayload(page, request);
      expect(response.data.entry_page).toContain("localhost:3000");
    });

    test("page_view event is tracked", async ({ page, request }) => {
      const response = await getPayload(page, request);
      const event = response.data.events.find(
        (e: any) => e.type === "page_view",
      );
      expect(event).toBeDefined();
      expect(event.data.location).toContain("localhost:3000");
      expect(typeof event.data.timestamp).toBe("number");
    });

    test("exit_page is tracked on pagehide", async ({ page, request }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
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
      expect(response.data.exit_page).toContain("localhost:3000");
    });

    // ── Click Events ─────────────────────────────────────────────────────────

    test("click event is tracked", async ({ page, request }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.click("#btn");
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find((e: any) => e.type === "click");
      expect(event).toBeDefined();
      expect(typeof event.data.x).toBe("number");
      expect(typeof event.data.y).toBe("number");
    });

    test("rage_click event is tracked after 3 rapid clicks", async ({
      page,
      request,
    }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.click("#btn");
      await page.click("#btn");
      await page.click("#btn");
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find((e: any) => {
        if (e.type !== "custom") return false;
        try {
          return (
            JSON.parse(e.data.data || e.data).name === "rage_click" ||
            e.data.name === "rage_click"
          );
        } catch {
          return false;
        }
      });
      expect(event).toBeDefined();
    });

    test("dead_click on non-interactive element is tracked", async ({
      page,
      request,
    }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() => {
        const div = document.createElement("div");
        div.id = "dead-zone";
        div.style.width = "100px";
        div.style.height = "100px";
        document.body.appendChild(div);
      });
      await page.click("#dead-zone");
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find(
        (e: any) => e.type === "custom" && e.data.name === "dead_click",
      );
      expect(event).toBeDefined();
    });

    // ── Navigation Events ─────────────────────────────────────────────────────

    test("outbound_click is tracked on external link", async ({
      page,
      request,
    }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);

      await page.evaluate(() => {
        const a = document.createElement("a");
        a.href = "https://external.com/page";
        a.id = "ext-link";
        a.target = "_blank";
        a.textContent = "External";
        document.body.appendChild(a);
      });

      await page
        .context()
        .route("https://external.com/**", (route) => route.abort());

      await page.evaluate(() => {
        document
          .getElementById("ext-link")!
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      // Wait for SDK click listener to process the event
      await page.waitForTimeout(300);
      await page.evaluate(() => window.unisights.flushNow());

      await expect
        .poll(
          async () => {
            const res = await request.get(
              `http://127.0.0.1:${port}/test/events`,
            );
            const data = await res.json();
            if (!data) return null;
            return data.data?.events?.find(
              (e: any) =>
                e.type === "custom" && e.data.name === "outbound_click",
            );
          },
          { timeout: 10000 },
        )
        .toBeDefined();
    });

    // ── File Download ─────────────────────────────────────────────────────────

    test("file_download is tracked on pdf link click", async ({
      page,
      request,
    }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);

      await page.evaluate(() => {
        const a = document.createElement("a");
        a.href = "http://localhost:3000/report.pdf";
        a.id = "dl-link";
        a.target = "_blank";
        a.textContent = "Download";
        document.body.appendChild(a);
      });

      await page.context().route("**/report.pdf", (route) => route.abort());

      await page.evaluate(() => {
        document
          .getElementById("dl-link")!
          .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      await page.waitForTimeout(300);
      await page.evaluate(() => window.unisights.flushNow());

      await expect
        .poll(
          async () => {
            const res = await request.get(
              `http://127.0.0.1:${port}/test/events`,
            );
            const data = await res.json();
            if (!data) return null;
            return data.data?.events?.find(
              (e: any) =>
                e.type === "custom" && e.data.name === "file_download",
            );
          },
          { timeout: 10000 },
        )
        .toBeDefined();
    });

    // ── Scroll ────────────────────────────────────────────────────────────────

    test("scroll depth is tracked", async ({ page, request }) => {
      await request.get(`http://127.0.0.1:${port}/test/clear`);
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);

      await page.evaluate(() => {
        document.body.style.height = "5000px";
        document.documentElement.style.height = "5000px";
      });

      // Trigger scroll multiple times to ensure tracker picks it up
      for (let i = 0; i < 5; i++) {
        await page.evaluate(
          (y) => {
            window.scrollTo(0, y);
            window.dispatchEvent(new Event("scroll"));
          },
          (i + 1) * 500,
        );
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(300);
      await page.evaluate(() => window.unisights.flushNow());

      // Poll until backend receives payload with scroll_depth > 0
      await expect
        .poll(
          async () => {
            const res = await request.get(
              `http://127.0.0.1:${port}/test/events`,
            );
            const data = await res.json();
            return data?.data?.scroll_depth ?? 0;
          },
          { timeout: 15000, intervals: [500, 1000, 1000] },
        )
        .toBeGreaterThan(0);
    });

    // ── Errors ────────────────────────────────────────────────────────────────

    test("js_error is tracked", async ({ page, request }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() => {
        window.dispatchEvent(
          new ErrorEvent("error", {
            message: "Test error",
            filename: "app.js",
            lineno: 10,
            colno: 5,
          }),
        );
      });
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find(
        (e: any) => e.type === "custom" && e.data.name === "js_error",
      );
      expect(event).toBeDefined();
    });

    test("unhandled_rejection is tracked", async ({ page, request }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() => {
        window.dispatchEvent(
          new PromiseRejectionEvent("unhandledrejection", {
            promise: Promise.resolve(),
            reason: "Network timeout",
          }),
        );
      });
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();

      const event = response.data.events.find(
        (e: any) =>
          e.type === "custom" && e.data.name === "unhandled_rejection",
      );
      expect(event).toBeDefined();
    });

    // ── Focus ─────────────────────────────────────────────────────────────────

    test("tab_focus event is tracked", async ({ page, request }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find(
        (e: any) => e.type === "custom" && e.data.name === "tab_focus",
      );
      expect(event).toBeDefined();
    });

    test("tab_blur event is tracked", async ({ page, request }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find(
        (e: any) => e.type === "custom" && e.data.name === "tab_blur",
      );
      expect(event).toBeDefined();
    });

    // ── Engagement Time ───────────────────────────────────────────────────────

    test("engaged_time event is tracked on pagehide", async ({
      page,
      request,
    }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.mouse.move(100, 100);
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
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
      const event = response.data.events.find(
        (e: any) => e.type === "custom" && e.data.name === "engaged_time",
      );
      expect(event).toBeDefined();
      const data = JSON.parse(event.data.data);
      expect(data).toHaveProperty("ms");
    });

    // ── Web Vitals ────────────────────────────────────────────────────────────

    test("web_vital events are tracked (CLS, LCP, FCP, INP, TTFB)", async ({
      page,
      request,
    }) => {
      const response = await getPayload(page, request);
      const vitals = response.data.events.filter(
        (e: any) => e.type === "web_vital",
      );
      const names = vitals.map((e: any) => e.data.name);
      expect(names.length).toBeGreaterThan(0);
      for (const v of vitals) {
        expect(typeof v.data.value).toBe("number");
        expect(["good", "needs-improvement", "poor"]).toContain(v.data.rating);
      }
    });

    // ── Custom Event ──────────────────────────────────────────────────────────

    test("custom event logged via window.unisights.log()", async ({
      page,
      request,
    }) => {
      await page.goto(PAGE_PATH);
      await page.waitForFunction(() => window.unisights !== undefined);
      await page.evaluate(() =>
        window.unisights.log("button_click", { id: "cta", label: "signup" }),
      );
      await page.evaluate(() => window.unisights.flushNow());
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
        .toBeDefined();
      const res = await request.get(`http://127.0.0.1:${port}/test/events`);
      const response = await res.json();
      const event = response.data.events.find(
        (e: any) => e.type === "custom" && e.data.name === "button_click",
      );
      expect(event).toBeDefined();
    });

    // ── Payload Structure ─────────────────────────────────────────────────────

    test("payload contains valid session_id and asset_id", async ({
      page,
      request,
    }) => {
      const response = await getPayload(page, request);
      expect(response.data.asset_id).toBe("e2e-test");
      expect(response.data.session_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    test("payload contains device_info", async ({ page, request }) => {
      const response = await getPayload(page, request);
      expect(response.data.device_info).toBeDefined();
    });

    test("payload scroll_depth is a number between 0 and 100", async ({
      page,
      request,
    }) => {
      const response = await getPayload(page, request);
      expect(response.data.scroll_depth).toBeGreaterThanOrEqual(0);
      expect(response.data.scroll_depth).toBeLessThanOrEqual(100);
    });
  });
});
