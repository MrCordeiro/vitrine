import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: "esm",
  platform: "node",
  target: "node20",
  dts: true,
  clean: true,
  sourcemap: true,
  // Emit .js/.d.ts (not tsdown's default .mjs/.d.mts) so the published
  // bin/exports paths stay ./dist/cli.js and ./dist/index.js.
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
