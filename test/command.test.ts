import { describe, expect, it } from "vitest";
import { selectScreens } from "../src/capture/command.js";
import type { ScreenConfig } from "../src/config/schema.js";

const screens: ScreenConfig[] = [
  { id: "home", flow: "flows/home.yaml", caption: "" },
  { id: "profile", flow: "flows/profile.yaml", caption: "" },
  { id: "settings", flow: "flows/settings.yaml", caption: "" },
];

describe("selectScreens", () => {
  it("returns all screens when --only is absent", () => {
    expect(selectScreens(screens, undefined)).toHaveLength(3);
  });

  it("filters to the requested ids, preserving config order", () => {
    const result = selectScreens(screens, "settings,home");
    expect(result.map((s) => s.id)).toEqual(["home", "settings"]);
  });

  it("tolerates whitespace and empty segments", () => {
    const result = selectScreens(screens, " profile , ");
    expect(result.map((s) => s.id)).toEqual(["profile"]);
  });

  it("throws on an unknown id", () => {
    expect(() => selectScreens(screens, "home,nope")).toThrow(
      /Unknown screen id/,
    );
  });
});
