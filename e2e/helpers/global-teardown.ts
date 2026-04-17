import { execSync } from "child_process";

export default async () => {
  const framework = process.env.FRAMEWORK_NAME;
  if (!framework) return;

  // Define ports for each framework
  const ports = {
    express: 3001,
    fastapi: 3002,
    flask: 3003,
    django: 3007,
    fastify: 3004,
    koa: 3006,
    nestjs: 3005,
  };

  const port = ports[framework as keyof typeof ports];
  if (!port) return;

  try {
    // Find PID using the port
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
    });
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const localAddress = parts[1];
        if (localAddress.endsWith(`:${port}`)) {
          const pid = parts[4];
          console.log(`Killing process ${pid} on port ${port}`);
          execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
          break;
        }
      }
    }
  } catch (error) {
    console.log(
      `No process found on port ${port} or failed to kill:`,
      error.message,
    );
  }
};
