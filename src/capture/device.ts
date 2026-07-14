import { existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import { assertToolInstalled, delay, run, waitFor } from "../util/exec.js";
import type { Config } from "../config/schema.js";

const BOOT_TIMEOUT_MS = 180_000;
const BOOT_POLL_MS = 2_000;

export interface AdbDevice {
  serial: string;
  /** e.g. "device", "offline", "unauthorized", "booting". */
  state: string;
}

/** Parse the output of `adb devices`. Pure — unit tested directly. */
export function parseAdbDevices(stdout: string): AdbDevice[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("*") && // adb daemon notices
        !line.startsWith("adb ") &&
        !/^List of devices attached/i.test(line),
    )
    .map((line) => {
      const [serial, state = "unknown"] = line.split(/\s+/);
      return { serial: serial ?? "", state };
    })
    .filter((device) => device.serial.length > 0);
}

function isEmulator(device: AdbDevice): boolean {
  return device.serial.startsWith("emulator-");
}

async function listDevices(): Promise<AdbDevice[]> {
  const { stdout } = await run("adb", ["devices"]);
  return parseAdbDevices(stdout);
}

/**
 * Resolve which device the capture run targets, booting the configured AVD if
 * no emulator is running. Returns the device serial.
 */
export async function resolveDevice(options: {
  serial?: string;
  avd: string;
}): Promise<string> {
  await assertToolInstalled(
    "adb",
    "Install Android platform-tools and ensure `adb` is on your PATH.",
    ["version"],
  );

  const devices = await listDevices();

  if (options.serial) {
    const match = devices.find((d) => d.serial === options.serial);
    if (!match) {
      const available = devices.map((d) => d.serial).join(", ") || "(none)";
      throw new Error(
        `Device "${options.serial}" not found. Connected devices: ${available}.`,
      );
    }
    if (match.state !== "device") {
      await waitForBoot(options.serial);
    }
    return options.serial;
  }

  const ready = devices.find((d) => isEmulator(d) && d.state === "device");
  if (ready) return ready.serial;

  const booting = devices.find((d) => isEmulator(d));
  if (booting) {
    await waitForBoot(booting.serial);
    return booting.serial;
  }

  return bootAvd(options.avd);
}

/** Boot the given AVD and wait for it to finish booting. Returns its serial. */
async function bootAvd(avd: string): Promise<string> {
  const emulatorBin = findEmulatorBinary();
  if (!emulatorBin) {
    throw new Error(
      "Could not locate the Android `emulator` binary. Set ANDROID_HOME (or " +
        "ANDROID_SDK_ROOT) to your SDK path, or start the emulator manually.",
    );
  }

  const before = new Set((await listDevices()).map((d) => d.serial));

  // Detach so the emulator keeps running for the whole capture session.
  const child = execa(emulatorBin, ["-avd", avd, "-no-snapshot-save"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  // Wait for a new emulator serial to appear.
  let serial: string | undefined;
  const appeared = await waitFor(
    async () => {
      const now = await listDevices();
      const fresh = now.find((d) => isEmulator(d) && !before.has(d.serial));
      if (fresh) {
        serial = fresh.serial;
        return true;
      }
      return false;
    },
    { timeoutMs: BOOT_TIMEOUT_MS, intervalMs: BOOT_POLL_MS },
  );

  if (!appeared || !serial) {
    throw new Error(
      `Timed out waiting for AVD "${avd}" to start. Check that the AVD name is correct.`,
    );
  }

  await waitForBoot(serial);
  return serial;
}

/** Block until `sys.boot_completed` is 1 for the given serial. */
async function waitForBoot(serial: string): Promise<void> {
  await run("adb", ["-s", serial, "wait-for-device"]).catch(() => undefined);

  const booted = await waitFor(
    async () => {
      const { stdout } = await run(
        "adb",
        ["-s", serial, "shell", "getprop", "sys.boot_completed"],
        { reject: false },
      );
      return stdout.trim() === "1";
    },
    { timeoutMs: BOOT_TIMEOUT_MS, intervalMs: BOOT_POLL_MS },
  );

  if (!booted) {
    throw new Error(`Timed out waiting for device "${serial}" to finish booting.`);
  }

  // Small settle delay after boot completes.
  await delay(1_000);
}

function findEmulatorBinary(): string | undefined {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (!sdk) return undefined;
  const candidates = [
    join(sdk, "emulator", "emulator"),
    join(sdk, "emulator", "emulator.exe"),
    join(sdk, "tools", "emulator"),
  ];
  return candidates.find((p) => existsSync(p));
}

/**
 * Ensure the app under test is present on the device: install the APK when
 * `apkPath` is set, otherwise verify the package is already installed.
 */
export async function ensureApp(
  app: Config["app"],
  serial: string,
): Promise<void> {
  if (app.apkPath) {
    if (!existsSync(app.apkPath)) {
      throw new Error(`APK not found at ${app.apkPath}.`);
    }
    await run("adb", ["-s", serial, "install", "-r", app.apkPath]);
    return;
  }

  const { stdout } = await run(
    "adb",
    ["-s", serial, "shell", "pm", "list", "packages", app.packageName],
    { reject: false },
  );
  const installed = stdout
    .split(/\r?\n/)
    .some((line) => line.trim() === `package:${app.packageName}`);

  if (!installed) {
    throw new Error(
      `Package "${app.packageName}" is not installed on ${serial}. ` +
        "Install your dev client / APK first, or set app.apkPath in the config.",
    );
  }
}
