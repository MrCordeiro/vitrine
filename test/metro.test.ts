import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/util/exec.js", () => ({
  run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
  assertToolInstalled: vi.fn(),
  delay: vi.fn(),
  waitFor: vi.fn(),
}));

const { setupMetroReverse, assertMetroRunning, overrideMetroHost } =
  await import("../src/capture/device.js");
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

describe("overrideMetroHost", () => {
  beforeEach(() => {
    vi.mocked(run).mockClear();
  });

  it("creates shared_prefs and writes debug_http_host via run-as", async () => {
    await overrideMetroHost("emulator-5554", "com.example.myapp", 8081);

    expect(run).toHaveBeenNthCalledWith(1, "adb", [
      "-s",
      "emulator-5554",
      "shell",
      "run-as",
      "com.example.myapp",
      "mkdir",
      "-p",
      "shared_prefs",
    ]);

    expect(run).toHaveBeenNthCalledWith(
      2,
      "adb",
      [
        "-s",
        "emulator-5554",
        "shell",
        'run-as com.example.myapp sh -c "cat > shared_prefs/com.example.myapp_preferences.xml"',
      ],
      {
        input: expect.stringContaining(
          '<string name="debug_http_host">localhost:8081</string>',
        ),
      },
    );
  });

  it("rejects a package name with unsafe characters", async () => {
    await expect(
      overrideMetroHost("emulator-5554", 'com.example."; rm -rf /', 8081),
    ).rejects.toThrow(/Invalid app\.packageName/);
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
