import { Page, APIRequestContext } from "@playwright/test";

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
  await page.evaluate(() => {
    window.unisights.flushNow();
  });

  const res = await request.get(`http://127.0.0.1:${port}/test/events`);
  return res.json();
}
