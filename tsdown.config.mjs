import { defineConfig } from "tsdown";

// tsdown loads its config (any extension) through `unrun`, its optional peer
// dep. It's absent under `npm ci` unless declared, so `unrun` is an explicit
// devDependency — without it CI fails with `Failed to import module "unrun"`
// on Nodes lacking native TS stripping (e.g. Node 20.19).
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
