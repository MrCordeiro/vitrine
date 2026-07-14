import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";
import type { ScreenConfig } from "../config/schema.js";
import { run } from "../util/exec.js";

/**
 * Extract every `takeScreenshot` name from a Maestro flow's text. Handles both
 * the shorthand (`takeScreenshot: home`) and object form
 * (`takeScreenshot: { path: home }`). Pure — unit tested directly.
 */
export function extractScreenshotNames(flowText: string): string[] {
  const names: string[] = [];
  for (const doc of parseAllDocuments(flowText)) {
    const value = doc.toJSON() as unknown;
    if (!Array.isArray(value)) continue; // skip the header document
    for (const step of value) {
      if (step && typeof step === "object" && "takeScreenshot" in step) {
        const target = (step as Record<string, unknown>).takeScreenshot;
        if (typeof target === "string") {
          names.push(stripPngExtension(target));
        } else if (
          target &&
          typeof target === "object" &&
          typeof (target as Record<string, unknown>).path === "string"
        ) {
          names.push(stripPngExtension((target as { path: string }).path));
        }
      }
    }
  }
  return names;
}

function stripPngExtension(name: string): string {
  return name.replace(/\.png$/i, "");
}

/**
 * Enforce the vitrine convention: the flow must call `takeScreenshot` with a
 * name equal to the screen id. Throws with an actionable message otherwise.
 */
export function assertFlowConvention(
  flowText: string,
  screen: ScreenConfig,
): void {
  const names = extractScreenshotNames(flowText);
  if (names.length === 0) {
    throw new Error(
      `Flow "${screen.flow}" has no takeScreenshot step. Add \`- takeScreenshot: ${screen.id}\`.`,
    );
  }
  if (!names.includes(screen.id)) {
    const found = names.join(", ");
    throw new Error(
      `Flow "${screen.flow}" takes screenshot(s) named [${found}] but screen id is "${screen.id}". The takeScreenshot name must match the screen id.`,
    );
  }
}

export interface RunFlowOptions {
  /** Directory that raw PNGs are written into (becomes Maestro's cwd). */
  rawDir: string;
  /** adb serial to target. */
  serial: string;
}

/**
 * Run a single Maestro flow and return the path to `<rawDir>/<id>.png`.
 *
 * Maestro writes `takeScreenshot: <id>` relative to its working directory, so
 * we run it with `cwd = rawDir`; a correctly-named screenshot lands exactly
 * where we want it. We never run `maestro test` on a directory.
 */
export async function runFlow(
  screen: ScreenConfig,
  options: RunFlowOptions,
): Promise<string> {
  const flowText = await readFile(screen.flow, "utf8");
  assertFlowConvention(flowText, screen);

  await mkdir(options.rawDir, { recursive: true });

  await run("maestro", ["--device", options.serial, "test", screen.flow], {
    cwd: options.rawDir,
    stdio: "inherit",
  });

  const output = join(options.rawDir, `${screen.id}.png`);
  if (!existsSync(output)) {
    throw new Error(
      `Flow completed but ${screen.id}.png was not produced in ${options.rawDir}. ` +
        `Confirm the flow calls \`takeScreenshot: ${screen.id}\`.`,
    );
  }
  return output;
}
