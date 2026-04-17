import { defineConfig } from "@playwright/test";
import { frameworks } from "./helpers/global-setup";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./helpers/global-setup.ts",
  globalTeardown: "./helpers/global-teardown.ts",
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
  ],

  projects: Object.entries(frameworks).map(([name, config]) => ({
    name: `${name}-chromium`,
    use: {
      browserName: "chromium",
      FRAMEWORK_NAME: name,
      FRAMEWORK_PORT: config.port.toString(),
    },
  })),

  reporter: [["list"]],
});
