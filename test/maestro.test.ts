import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertFlowConvention,
  extractScreenshotNames,
} from "../src/capture/maestro.js";
import type { ScreenConfig } from "../src/config/schema.js";

const screen = (over: Partial<ScreenConfig> = {}): ScreenConfig => ({
  id: "home",
  flow: "flows/home.yaml",
  caption: "",
  ...over,
});

describe("extractScreenshotNames", () => {
  it("reads the shorthand form and ignores the header doc", () => {
    const flow = [
      "appId: com.example.myapp",
      "---",
      "- launchApp:",
      "    clearState: true",
      '- assertVisible: "Home"',
      "- takeScreenshot: home",
    ].join("\n");
    expect(extractScreenshotNames(flow)).toEqual(["home"]);
  });

  it("reads the object form and strips a .png extension", () => {
    const flow = [
      "appId: com.example.myapp",
      "---",
      "- takeScreenshot:",
      "    path: profile.png",
    ].join("\n");
    expect(extractScreenshotNames(flow)).toEqual(["profile"]);
  });

  it("returns an empty array when there is no takeScreenshot step", () => {
    const flow = ["appId: x", "---", '- assertVisible: "Home"'].join("\n");
    expect(extractScreenshotNames(flow)).toEqual([]);
  });
});

describe("assertFlowConvention", () => {
  it("passes when a takeScreenshot name matches the screen id", () => {
    const flow = "appId: x\n---\n- takeScreenshot: home";
    expect(() => assertFlowConvention(flow, screen())).not.toThrow();
  });

  it("throws when the flow has no takeScreenshot", () => {
    const flow = "appId: x\n---\n- assertVisible: Home";
    expect(() => assertFlowConvention(flow, screen())).toThrow(
      /no takeScreenshot/,
    );
  });

  it("throws when the name does not match the id", () => {
    const flow = "appId: x\n---\n- takeScreenshot: dashboard";
    expect(() => assertFlowConvention(flow, screen({ id: "home" }))).toThrow(
      /must match the screen id/,
    );
  });
});

// runFlow drives the filesystem + maestro; mock those boundaries.
vi.mock("node:fs", () => ({ existsSync: vi.fn(() => true) }));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => "appId: x\n---\n- takeScreenshot: home"),
  mkdir: vi.fn(async () => undefined),
}));
vi.mock("../src/util/exec.js", () => ({
  run: vi.fn(async () => ({ stdout: "" })),
}));

describe("runFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes maestro with the device and returns the raw png path", async () => {
    const { runFlow } = await import("../src/capture/maestro.js");
    const { run } = await import("../src/util/exec.js");

    const out = await runFlow(screen(), {
      rawDir: "/tmp/raw",
      serial: "emulator-5554",
    });

    expect(out).toBe("/tmp/raw/home.png");
    expect(run).toHaveBeenCalledWith(
      "maestro",
      ["--device", "emulator-5554", "test", "flows/home.yaml"],
      expect.objectContaining({ cwd: "/tmp/raw" }),
    );
  });

  it("throws when the expected png was not produced", async () => {
    const fs = await import("node:fs");
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);
    const { runFlow } = await import("../src/capture/maestro.js");

    await expect(
      runFlow(screen(), { rawDir: "/tmp/raw", serial: "emulator-5554" }),
    ).rejects.toThrow(/was not produced/);
  });
});
