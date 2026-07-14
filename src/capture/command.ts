import { resolve } from "node:path";
import { loadConfig } from "../config/load.js";
import type { Config, ScreenConfig } from "../config/schema.js";
import { assertToolInstalled } from "../util/exec.js";
import { type CaptureResult, printSummary } from "../util/report.js";
import { ensureApp, resolveDevice } from "./device.js";
import { runFlow } from "./maestro.js";

export interface CaptureOptions {
  /** Path to the config file (`--config`). */
  config?: string;
  /** Comma-separated screen ids (`--only`). */
  only?: string;
  /** Target device serial (`--serial`). */
  serial?: string;
  /** Base output directory; defaults to `<cwd>/screenshots`. */
  outDir?: string;
}

/**
 * Select the screens to capture, preserving config order. Throws if `--only`
 * references an unknown id. Pure — unit tested directly.
 */
export function selectScreens(
  screens: ScreenConfig[],
  only: string | undefined,
): ScreenConfig[] {
  if (!only) return screens;
  const wanted = only
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const known = new Set(screens.map((s) => s.id));
  const unknown = wanted.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown screen id(s) in --only: ${unknown.join(", ")}. ` +
        `Known ids: ${[...known].join(", ")}.`,
    );
  }
  const wantedSet = new Set(wanted);
  return screens.filter((s) => wantedSet.has(s.id));
}

/**
 * Run the `capture` command. Returns a process exit code (0 = all captured).
 */
export async function runCapture(options: CaptureOptions): Promise<number> {
  const { config } = await loadConfig(options.config);

  // Validate the screen selection against config before touching any tooling.
  const screens = selectScreens(config.screens, options.only);
  if (screens.length === 0) {
    process.stdout.write("No screens selected.\n");
    return 0;
  }

  await assertToolInstalled(
    "maestro",
    "Install Maestro: https://maestro.mobile.dev/getting-started/installing-maestro",
  );

  const serial = await resolveDevice({
    serial: options.serial,
    avd: config.device.avd,
  });
  await ensureApp(config.app, serial);

  const rawDir = resolve(options.outDir ?? "screenshots", "raw");
  const results: CaptureResult[] = [];

  for (const screen of screens) {
    process.stdout.write(`\n▶ Capturing "${screen.id}" (${screen.flow})\n`);
    try {
      const path = await runFlow(screen, { rawDir, serial });
      results.push({ id: screen.id, status: "captured", path });
    } catch (error) {
      results.push({
        id: screen.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failures = printSummary(results);
  return failures > 0 ? 1 : 0;
}

// Re-export so callers can build a config without a second import.
export type { Config };
