import { defineConfig } from "tsdown";

// Plain ESM (not .ts) on purpose: tsdown loads a .ts config through the
// optional `unrun` peer dep or native TS stripping, neither of which is
// guaranteed on every supported Node (e.g. Node 20.19 in CI). A .mjs config is
// imported natively everywhere, so no extra dependency is needed.
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
