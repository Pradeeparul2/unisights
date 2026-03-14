import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    alias: {
      // intercept both imports
      "@pradeeparul2/unisights-core/wasm": path.resolve(
        __dirname,
        "./tests/__mocks__/wasm-binary.ts",
      ),
      "@pradeeparul2/unisights-core": path.resolve(
        __dirname,
        "./tests/__mocks__/wasm.ts",
      ),
    },
  },
});
