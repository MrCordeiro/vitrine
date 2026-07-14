import { relative } from "node:path";

export type CaptureStatus = "captured" | "failed";

export interface CaptureResult {
  id: string;
  status: CaptureStatus;
  /** Absolute path to the raw PNG when captured. */
  path?: string;
  /** Error message when failed. */
  error?: string;
}

const CHECK = "✓"; // ✓
const CROSS = "✗"; // ✗

/** Print a per-screen summary table. Returns the number of failures. */
export function printSummary(
  results: CaptureResult[],
  cwd: string = process.cwd(),
): number {
  const failures = results.filter((r) => r.status === "failed").length;
  const width = Math.max(2, ...results.map((r) => r.id.length));

  process.stdout.write("\nCapture summary\n");
  process.stdout.write(`${"-".repeat("Capture summary".length)}\n`);

  for (const result of results) {
    const mark = result.status === "captured" ? CHECK : CROSS;
    const id = result.id.padEnd(width);
    const detail =
      result.status === "captured"
        ? result.path
          ? relative(cwd, result.path)
          : ""
        : (result.error ?? "failed");
    process.stdout.write(`${mark} ${id}  ${detail}\n`);
  }

  const captured = results.length - failures;
  process.stdout.write(
    `\n${results.length} screen(s) · ${captured} captured · ${failures} failed\n`,
  );
  return failures;
}
