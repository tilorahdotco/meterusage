import { afterEach, describe, expect, it } from "vite-plus/test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { appDataDirectory, localRoot, supportRoot } from "../src/main/platform";
import { launchConfiguration } from "../src/main/launch";
import { Preferences } from "../src/main/preferences";
import { DesktopConnections } from "../src/main/connections";
import { Updater, parseRelease, parseReleases } from "../src/main/updater";
import { autostartEnabled, autostartEntry, autostartExecutable, autostartPath, setAutostart } from "../src/main/linux-autostart";

// Linux branches take the platform explicitly, so they run on every test host.
// Filesystem cases use POSIX paths and are skipped on the Windows runner.
const posixHost = process.platform !== "win32";
const roots: string[] = [];
const temp = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), "meterusage-linux-fixture-"))); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const noDefaults = async () => { throw new Error("defaults must not run on Linux"); };

describe("Linux paths", () => {
  it("keeps app data in the XDG config folder and accepts XDG_CONFIG_HOME only under the home", () => {
    expect(supportRoot("/home/testuser", "linux", {})).toBe("/home/testuser/.config");
    expect(appDataDirectory("/home/testuser", "linux", {})).toBe("/home/testuser/.config/MeterUsage");
    expect(supportRoot("/home/testuser", "linux", { XDG_CONFIG_HOME: "/home/testuser/dotfiles/config/" })).toBe("/home/testuser/dotfiles/config");
    // Outside the home, relative or empty values fall back, so isolated homes never reach the real profile.
    for (const value of ["/etc/xdg", "config", "", "/home/testuser/../other/.config"]) expect(supportRoot("/home/testuser", "linux", { XDG_CONFIG_HOME: value })).toBe("/home/testuser/.config");
    expect(localRoot("/home/testuser", "linux", {})).toBe("/home/testuser/.config");
    // macOS is unchanged.
    expect(appDataDirectory("/Users/testuser", "darwin", { XDG_CONFIG_HOME: "/Users/testuser/.xdg" })).toBe("/Users/testuser/Library/Application Support/MeterUsage");
  });
  it("records Linux on an installed launch and leaves macOS launches unmarked", () => {
    expect(launchConfiguration([], { PATH: "/usr/bin" }, "/home/testuser", false, "linux")).toMatchObject({ demo: false, home: "/home/testuser", data: "/home/testuser/.config/MeterUsage", platform: "linux" });
    expect(launchConfiguration([], {}, "/Users/testuser", false, "darwin")).not.toHaveProperty("platform");
  });
});

describe.skipIf(!posixHost)("Linux preferences and connections", () => {
  it("keeps installed Linux preferences in JSON without the macOS defaults tool", async () => {
    const root = temp(), launch = { home: root, data: root, env: {}, demo: false, candidate: false, platform: "linux" as const };
    const prefs = await Preferences.load(launch, noDefaults);
    expect(prefs.jsonStore).toBe(true);
    await prefs.set("quotaAlertsEnabled", false);
    expect(JSON.parse(readFileSync(join(root, "preferences.json"), "utf8")).quotaAlertsEnabled).toBe(false);
    expect((await Preferences.load(launch, noDefaults)).values.quotaAlertsEnabled).toBe(false);
    // Damaged installed preferences are set aside, as on Windows.
    writeFileSync(join(root, "preferences.json"), "{");
    await Preferences.load(launch, noDefaults);
    expect(existsSync(join(root, "preferences.json"))).toBe(false);
  });
  it("offers only the Codex connection and refuses desktop readers", async () => {
    const root = temp(), launch = { home: root, data: root, env: {}, demo: false, candidate: false, platform: "linux" as const };
    const prefs = await Preferences.load(launch, noDefaults);
    const connections = new DesktopConnections(launch, prefs, join(root, "missing-helper"), () => {}, async () => { throw new Error("no helper may run"); });
    expect(connections.state.map(c => [c.provider, c.status])).toEqual([["codex", "disconnected"], ["claude", "unsupported"], ["antigravity", "unsupported"], ["grok", "unsupported"]]);
    for (const provider of ["claude", "antigravity", "grok"] as const) await expect(connections.connect(provider, async () => {}, async () => true)).rejects.toThrow("Connection unavailable");
    await prefs.set("desktopClaudeIdentity", "off");
    expect(connections.enabled("claude")).toBe(false);
  });
  it("passes the session bus to Codex so its keyring reaches the Secret Service", async () => {
    const root = temp(), env = { PATH: "/usr/bin", TMPDIR: "/tmp", DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus", XDG_RUNTIME_DIR: "/run/user/1000", OPENAI_API_KEY: "synthetic" };
    const linux = new DesktopConnections({ home: root, data: root, env, demo: false, candidate: false, platform: "linux" }, await Preferences.load({ home: root, data: root, env, demo: false, candidate: false, platform: "linux" }, noDefaults), "", () => {});
    const codexEnv = linux["env"]("profile");
    expect(codexEnv).toMatchObject({ HOME: root, CODEX_HOME: join(root, "connections", "codex", "profile"), DBUS_SESSION_BUS_ADDRESS: env.DBUS_SESSION_BUS_ADDRESS, XDG_RUNTIME_DIR: env.XDG_RUNTIME_DIR });
    expect(codexEnv).not.toHaveProperty("OPENAI_API_KEY");
    const mac = new DesktopConnections({ home: root, data: root, env, demo: false, candidate: false }, await Preferences.load({ home: root, data: root, env, demo: true, candidate: false }, noDefaults), "", () => {});
    expect(mac["env"]("profile")).not.toHaveProperty("DBUS_SESSION_BUS_ADDRESS");
  });
});

describe("Linux updates", () => {
  const release = { tag_name: "v0.3.0", draft: false, assets: [{ name: "MeterUsage-0.3.0-mac-arm64.zip", browser_download_url: "https://github.com/tilorahdotco/meterusage/releases/download/v0.3.0/MeterUsage-0.3.0-mac-arm64.zip", digest: "sha256:" + "a".repeat(64) }] };
  it("selects no release asset on Linux", () => {
    expect(() => parseRelease(JSON.stringify(release), "linux")).toThrow("Invalid update asset");
    expect(() => parseReleases(JSON.stringify([release]), "linux")).toThrow();
    expect(parseRelease(JSON.stringify(release), "darwin").version).toBe("0.3.0");
  });
  it.skipIf(!posixHost)("makes no release check and refuses installation", async () => {
    const root = temp(), prefs = await Preferences.load({ home: root, data: root, env: {}, demo: false, candidate: false, platform: "linux" }, noDefaults);
    await prefs.set("updateCheckEnabled", true);
    const updater = new Updater(prefs, "0.2.0", () => {}, async () => { throw new Error("no download may run"); });
    expect(updater.supported).toBe(false);
    expect(updater.checkIfDue()).toBeUndefined();
    await expect(updater.checkNow()).rejects.toThrow("Update checks unavailable");
    await expect(updater.install(root, { version: "0.3.0", tag: "v0.3.0", asset: { url: release.assets[0].browser_download_url, digest: release.assets[0].digest } })).rejects.toThrow("Update installation unavailable");
    expect(prefs.values.updateLastCheckDate ?? 0).toBe(0);
  });
});

describe("Linux autostart", () => {
  it("writes a quoted Exec line and refuses paths that would need escaping", () => {
    expect(autostartEntry("/opt/MeterUsage/meterusage")).toContain('Exec="/opt/MeterUsage/meterusage"\n');
    for (const path of ["relative/meterusage", '/opt/a"b', "/opt/$HOME", "/opt/a`b", "/opt/a\\b", "/opt/100%", "/opt/a\nExec=/bin/sh"]) expect(() => autostartEntry(path), path).toThrow("Could not change login item");
    expect(autostartPath("/home/testuser", {})).toBe("/home/testuser/.config/autostart/dev.meterusage.app.desktop");
  });
  it.skipIf(!posixHost)("starts the AppImage file when present, else the executable", () => {
    const root = temp(), image = join(root, "MeterUsage.AppImage"); writeFileSync(image, "synthetic");
    expect(autostartExecutable("/tmp/.mount_x/meterusage", { APPIMAGE: image })).toBe(image);
    expect(autostartExecutable("/opt/MeterUsage/meterusage", { APPIMAGE: join(root, "missing") })).toBe("/opt/MeterUsage/meterusage");
    expect(autostartExecutable("/opt/MeterUsage/meterusage", { APPIMAGE: "relative.AppImage" })).toBe("/opt/MeterUsage/meterusage");
  });
  it.skipIf(!posixHost)("adds and removes the entry", () => {
    const home = temp(), path = autostartPath(home, {});
    expect(autostartEnabled(home, {})).toBe(false);
    setAutostart(home, {}, true, "/opt/MeterUsage/meterusage");
    expect(autostartEnabled(home, {})).toBe(true);
    expect(readFileSync(path, "utf8")).toBe(autostartEntry("/opt/MeterUsage/meterusage"));
    expect(statSync(path).mode & 0o777).toBe(0o644);
    expect(() => setAutostart(home, {}, true, "/opt/$x")).toThrow("Could not change login item");
    expect(readFileSync(path, "utf8")).toBe(autostartEntry("/opt/MeterUsage/meterusage"));
    setAutostart(home, {}, false, "/opt/MeterUsage/meterusage");
    expect(autostartEnabled(home, {})).toBe(false);
    setAutostart(home, {}, false, "/opt/MeterUsage/meterusage");
  });
});

describe("Linux packaging", () => {
  it("leaves the Linux executable to electron-builder and still refuses other platforms", async () => {
    const afterPack = createRequire(import.meta.url)("../Scripts/electron/after-pack.cjs");
    await expect(afterPack({ electronPlatformName: "linux", appOutDir: "/nonexistent" })).resolves.toBeUndefined();
    await expect(afterPack({ electronPlatformName: "freebsd", appOutDir: "/nonexistent" })).rejects.toThrow("Only macOS, Windows and Linux packaging are enabled");
  });
});
