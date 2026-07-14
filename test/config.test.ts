import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";
import { describe, it, expect } from "vitest";
import { configSchema } from "../src/config/schema.js";
import { loadConfig } from "../src/config/load.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures");

const base = {
  app: { packageName: "com.example.myapp" },
  device: { avd: "Pixel_7_API_34" },
  frame: { background: ["#1a1a2e", "#16213e"] as [string, string] },
  publish: { serviceAccountKeyPath: "./secrets/key.json" },
  screens: [{ id: "home", flow: "flows/home.yaml" }],
};

describe("configSchema", () => {
  it("applies defaults for omitted fields", () => {
    const parsed = configSchema.parse(base);
    expect(parsed.device.locale).toBe("en-US");
    expect(parsed.frame.template).toBe("gradient");
    expect(parsed.frame.textColor).toBe("#ffffff");
    expect(parsed.frame.font).toBe("Inter");
    expect(parsed.publish.track).toBe("listing");
    expect(parsed.screens[0]?.caption).toBe("");
  });

  it("accepts a solid background color", () => {
    const parsed = configSchema.parse({ ...base, frame: { background: "#101010" } });
    expect(parsed.frame.background).toBe("#101010");
  });

  it("rejects a missing packageName", () => {
    const result = configSchema.safeParse({ ...base, app: {} });
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues[0]?.path).toEqual([
      "app",
      "packageName",
    ]);
  });

  it("rejects an unknown template", () => {
    const result = configSchema.safeParse({
      ...base,
      frame: { template: "neon", background: "#101010" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed background color", () => {
    const result = configSchema.safeParse({ ...base, frame: { background: "blue" } });
    expect(result.success).toBe(false);
  });

  it("rejects an empty screens array", () => {
    const result = configSchema.safeParse({ ...base, screens: [] });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate screen ids", () => {
    const result = configSchema.safeParse({
      ...base,
      screens: [
        { id: "home", flow: "a.yaml" },
        { id: "home", flow: "b.yaml" },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues.map((i) => i.message).join()).toMatch(
      /duplicate screen id "home"/,
    );
  });
});

describe("loadConfig", () => {
  it("loads and validates a JSON config, resolving paths to absolute", async () => {
    const { config, configPath } = await loadConfig(join(fixtures, "valid.config.json"));
    expect(config.app.packageName).toBe("com.example.myapp");
    expect(config.device.locale).toBe("en-US"); // default applied
    expect(isAbsolute(config.screens[0]!.flow)).toBe(true);
    expect(config.screens[0]!.flow).toBe(join(fixtures, "flows/home.yaml"));
    expect(isAbsolute(config.app.apkPath!)).toBe(true);
    expect(isAbsolute(config.publish.serviceAccountKeyPath)).toBe(true);
    expect(configPath).toBe(join(fixtures, "valid.config.json"));
  });

  it("loads a TypeScript config via jiti", async () => {
    const { config } = await loadConfig(join(fixtures, "valid.config.ts"));
    expect(config.app.packageName).toBe("com.example.tsapp");
    expect(config.frame.template).toBe("solid");
    expect(config.screens[0]?.caption).toBe("TS caption");
  });

  it("throws a readable error for a missing config file", async () => {
    await expect(loadConfig(join(fixtures, "does-not-exist.ts"))).rejects.toThrow(
      /Config file not found/,
    );
  });
});
