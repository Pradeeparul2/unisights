import { spawn } from "child_process";

export const frameworks = {
  express: {
    port: 3001,
    command: "npm run servers:express",
  },
  fastapi: {
    port: 3002,
    command: "python -m uvicorn frameworks.fastapi:app --port 3002",
  },
  flask: {
    port: 3003,
    command: "python -m flask --app frameworks.flask_app run --port 3003",
  },
  fastify: {
    port: 3004,
    command: "npm run servers:fastify",
  },
  nestjs: {
    port: 3005,
    command: "npm run servers:nestjs",
  },
};

export default async () => {
  const framework = process.env.FRAMEWORK_NAME as keyof typeof frameworks;

  if (!framework || !frameworks[framework]) return;

  const { command } = frameworks[framework];

  spawn(command, {
    shell: true,
    stdio: "inherit",
  });

  // wait for server (simple delay or use wait-on)
  await new Promise((res) => setTimeout(res, 5000));
};
