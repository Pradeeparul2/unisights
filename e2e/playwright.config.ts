import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",

  timeout: 30000,

  retries: 0,

  use: {
    headless: true,
    baseURL: "http://localhost:3000",
  },

  /* serve the test HTML page */
  webServer: [
    {
      command: "npx serve ./pages -l 3000",
      port: 3000,
      reuseExistingServer: true,
    },
    {
      command: "node frameworks/express.ts",
      port: 3001,
      reuseExistingServer: true,
    },
    {
      command: "uvicorn frameworks.fastapi:app --port 3002",
      port: 3002,
      reuseExistingServer: true,
    },
  ],

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    {
      name: "edge",
      use: {
        browserName: "chromium",
        channel: "msedge",
      },
    },
    {
      name: "safari",
      use: {
        browserName: "webkit",
      },
    },
  ],

  reporter: [["list"]],
});
