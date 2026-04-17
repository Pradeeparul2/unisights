import { spawn } from "child_process";
import { waitForServer } from "./server-health";

export const frameworks = {
  express: {
    port: 3001,
    command: "npm run servers:express",
    namespace: "express",
  },
  fastapi: {
    port: 3002,
    command: "python -m uvicorn frameworks.fastapi:app --port 3002",
    namespace: "fastapi",
  },
  flask: {
    port: 3003,
    command: "python -m flask --app frameworks.flask_app run --port 3003",
    namespace: "flask",
  },
  django: {
    port: 3007,
    command: "python -m uvicorn frameworks.django_app:asgi_app --port 3007",
    namespace: "django",
  },
  fastify: {
    port: 3004,
    command: "npm run servers:fastify",
    namespace: "fastify",
  },
  koa: {
    port: 3006,
    command: "npm run servers:koa",
    namespace: "koa",
  },
  nestjs: {
    port: 3005,
    command: "npm run servers:nestjs",
    namespace: "nestjs",
  },
};

export default async () => {
  const framework = process.env.FRAMEWORK_NAME as keyof typeof frameworks;

  if (!framework || !frameworks[framework]) return;

  const { command, port } = frameworks[framework];

  spawn(command, {
    shell: true,
    stdio: "inherit",
  });

  // Wait for server to be ready with health check
  try {
    await waitForServer(port, 60, 500); // 60 attempts, 500ms between each = 30 seconds max
    console.log(`✓ Framework server on port ${port} started successfully`);
  } catch (error) {
    console.error(`✗ Failed to start framework server on port ${port}:`, error);
    throw error;
  }
};
