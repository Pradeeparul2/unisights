import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests",

  timeout: 30000,

  retries: 0,

  use: {
    headless: true,
    baseURL: "http://localhost:3000",
  },

  /* serve the test HTML page */
  webServer: {
    command: "npx serve ./pages -l 3000",
    port: 3000,
    reuseExistingServer: true,
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  reporter: [["list"]],
});
