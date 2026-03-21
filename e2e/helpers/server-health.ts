export async function checkServerHealth(
  port: number,
  path = "/health",
): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}${path}`, {
      method: "GET",
      timeout: 5000,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForServer(
  port: number,
  maxAttempts = 30,
  delayMs = 1000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkServerHealth(port, "/health")) {
      console.log(`✓ Server on port ${port} is ready`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(
    `Server on port ${port} failed to start after ${maxAttempts * delayMs}ms`,
  );
}
