export async function getPayload(
  page: any,
  request: any,
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
