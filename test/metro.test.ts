import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/util/exec.js", () => ({
  run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
  assertToolInstalled: vi.fn(),
  delay: vi.fn(),
  waitFor: vi.fn(),
}));

const { setupMetroReverse, assertMetroRunning } = await import(
  "../src/capture/device.js"
);
const { run } = await import("../src/util/exec.js");

describe("setupMetroReverse", () => {
  it("runs `adb reverse` for the configured metro port", async () => {
    await setupMetroReverse("emulator-5554", 8081);
    expect(run).toHaveBeenCalledWith("adb", [
      "-s",
      "emulator-5554",
      "reverse",
      "tcp:8081",
      "tcp:8081",
    ]);
  });
});

describe("assertMetroRunning", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("resolves when Metro reports it is running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "packager-status:running",
      })),
    );
    await expect(assertMetroRunning(8081)).resolves.toBeUndefined();
  });

  it("throws an actionable error when Metro is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    await expect(assertMetroRunning(8081)).rejects.toThrow(
      /not reachable[\s\S]*npx expo start/,
    );
  });

  it("throws with the HTTP status when a non-Metro server answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, text: async () => "" })),
    );
    await expect(assertMetroRunning(8081)).rejects.toThrow(/HTTP 404/);
  });

  it("throws when Metro responds but is not ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "starting…",
      })),
    );
    await expect(assertMetroRunning(8081)).rejects.toThrow(/not ready/);
  });
});
