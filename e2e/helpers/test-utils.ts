import { Page, APIRequestContext, expect } from "@playwright/test";

export async function clearEvents(request: APIRequestContext, port: number) {
  await request.get(`http://127.0.0.1:${port}/test/clear`);
}

export async function getPayload(
  page: Page,
  request: APIRequestContext,
  port: number,
  name: string,
) {
  const endpoint = encodeURIComponent(
    `http://127.0.0.1:${port}/collect-${name}/event`,
  );

  await page.goto(`/?endpoint=${endpoint}`);
  await page.waitForFunction(() => window.unisights !== undefined);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.unisights.flushNow();
  });
  await expect
    .poll(
      async () => {
        const res = await request.get(`http://127.0.0.1:${port}/test/events`);
        return res.json();
      },
      { timeout: 10000 },
    )
    .not.toBeNull();
  const res = await request.get(`http://127.0.0.1:${port}/test/events`);
  return res.json();
}
