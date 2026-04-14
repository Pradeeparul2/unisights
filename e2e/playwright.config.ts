import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    baseURL: "http://localhost:3000",
  },

  webServer: [
    {
      command: "npx serve ./pages -l 3000",
      port: 3000,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "npm run servers:express",
      port: 3001,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "python -m uvicorn frameworks.fastapi:app --port 3002",
      port: 3002,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "python -m flask --app frameworks.flask_app run --port 3003",
      port: 3003,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "npm run servers:fastify",
      port: 3004,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  reporter: [["list"]],
});
