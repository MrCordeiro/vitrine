import { describe, it, expect } from "vitest";
import { parseAdbDevices } from "../src/capture/device.js";

describe("parseAdbDevices", () => {
  it("parses ready, offline, and unauthorized devices", () => {
    const stdout = [
      "List of devices attached",
      "emulator-5554\tdevice",
      "emulator-5556\toffline",
      "R58M12345\tunauthorized",
      "",
    ].join("\n");

    expect(parseAdbDevices(stdout)).toEqual([
      { serial: "emulator-5554", state: "device" },
      { serial: "emulator-5556", state: "offline" },
      { serial: "R58M12345", state: "unauthorized" },
    ]);
  });

  it("returns an empty list when no devices are attached", () => {
    expect(parseAdbDevices("List of devices attached\n\n")).toEqual([]);
  });

  it("ignores daemon notices and the header line anywhere", () => {
    const stdout = [
      "* daemon not running; starting now at tcp:5037",
      "* daemon started successfully",
      "List of devices attached",
      "emulator-5554\tdevice",
    ].join("\n");
    expect(parseAdbDevices(stdout)).toEqual([
      { serial: "emulator-5554", state: "device" },
    ]);
  });
});
