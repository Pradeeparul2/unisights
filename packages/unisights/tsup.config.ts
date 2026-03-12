import { defineConfig } from "tsup";

const wasmConfig = {
  noExternal: ["@pradeeparul/unisights-core", "web-vitals"],
  esbuildOptions(options: any) {
    options.loader = {
      ".wasm": "binary",
    };
  },
};

export default defineConfig([
  // ESM
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: false, // ← remove dts from here
    sourcemap: false,
    clean: true,
    ...wasmConfig,
  },
  // CJS
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: false,
    sourcemap: false,
    clean: false,
    ...wasmConfig,
  },
  // IIFE
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "Analytics",
    dts: false,
    sourcemap: false,
    clean: false,
    minify: true,
    ...wasmConfig,
  },
  // DTS only — produces index.d.ts, no JS output
  {
    entry: ["src/index.ts"],
    format: ["cjs"], // ← cjs format forces .d.ts not .d.mts
    dts: { only: true },
    sourcemap: false,
    clean: false,
    noExternal: ["@pradeeparul/unisights-core", "web-vitals"],
  },
]);
