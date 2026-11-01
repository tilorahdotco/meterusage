import { afterEach, describe, expect, it } from "vite-plus/test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appDataDirectory, envValue, localRoot, minimalEnvironment, spawnPlan, supportRoot, systemBinary, withEnvValue, within } from "../src/main/platform";
import { launchConfiguration } from "../src/main/launch";
import { Preferences } from "../src/main/preferences";
import { cliEnvironment, cliPath, runCommand } from "../src/main/providers/transport";
import { runtimeCandidates } from "../src/main/providers/antigravity";
import { apiBillingPath, readApiBilling, writeApiBilling } from "../src/main/providers/api-billing";
import { flyoutOrigin } from "../src/domain/notch";
import { DesktopConnections } from "../src/main/connections";
import { chromiumKey, dpapiUnprotect, powershell, powershellArgs } from "../src/main/providers/windows-dpapi";
import { windowsDiscoveryScript } from "../src/main/providers/antigravity-desktop";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { ClaudeActivitySource } from "../src/main/providers/activity";
import type { ApiBillingSnapshot } from "../src/domain/api-billing";

const roots: string[] = [];
const temp = () => { const root = realpathSync(mkdtempSync(join(tmpdir(), "meterusage-platform-fixture-"))); roots.push(root); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const home = "C:\\Users\\testuser", roaming = `${home}\\AppData\\Roaming`;

describe("Windows paths and environment", () => {
  it("uses roaming AppData for app data and falls back when APPDATA leaves the profile", () => {
    expect(supportRoot(home, "win32", { APPDATA: roaming })).toBe(roaming);
    expect(appDataDirectory(home, "win32", { appdata: roaming })).toBe(`${roaming}\\MeterUsage`);
    expect(supportRoot(home, "win32", { APPDATA: "\\\\server\\share\\testuser" })).toBe(roaming);
    expect(supportRoot(home, "win32", {})).toBe(roaming);
    expect(localRoot(home, "win32", { LOCALAPPDATA: `${home}\\AppData\\Local` })).toBe(`${home}\\AppData\\Local`);
    expect(appDataDirectory("/Users/testuser", "darwin", {})).toBe("/Users/testuser/Library/Application Support/MeterUsage");
  });
  it("selects the Windows app data directory for an installed launch", () => {
    const launch = launchConfiguration([], { Path: "C:\\Windows\\System32", APPDATA: roaming }, home, false, "win32");
    expect(launch).toMatchObject({ demo: false, home, data: `${roaming}\\MeterUsage`, platform: "win32" });
    expect(launchConfiguration([], {}, "/Users/testuser", false, "darwin")).not.toHaveProperty("platform");
  });
  it("compares containment across separators, case and drives", () => {
    expect(within("C:\\Users\\testuser\\AppData", "c:\\users\\TESTUSER\\appdata\\Roaming", "win32")).toBe(true);
    expect(within("C:\\Users\\testuser\\AppData", "D:\\Users\\testuser\\AppData", "win32")).toBe(false);
    expect(within("C:\\Users\\testuser\\AppData", "C:\\Users\\testuser\\AppDataOther", "win32")).toBe(false);
    expect(within("/Users/testuser/Library", "/Users/testuser/Library/x", "darwin")).toBe(true);
    expect(within("/Users/testuser/Library", "/Users/testuser/..Library", "darwin")).toBe(false);
  });
  it("reads and replaces case-insensitive Windows variables without duplicates", () => {
    const env = { Path: "C:\\Tools", SystemRoot: "C:\\Windows" };
    expect(envValue(env, "PATH", "win32")).toBe("C:\\Tools");
    expect(envValue(env, "PATH", "darwin")).toBeUndefined();
    expect(withEnvValue(env, "PATH", "C:\\Other", "win32")).toEqual({ Path: "C:\\Other", SystemRoot: "C:\\Windows" });
    const extended = cliEnvironment(home, { Path: "C:\\Tools", APPDATA: roaming }, "win32");
    expect(Object.keys(extended).filter(key => key.toUpperCase() === "PATH")).toEqual(["Path"]);
    expect(extended.Path).toBe([`${roaming}\\npm`, `${home}\\.cargo\\bin`, `${home}\\.local\\bin`, "C:\\Tools"].join(";"));
  });
  it("keeps only the variables an isolated Windows subprocess needs", () => {
    const env = { Path: "C:\\Tools", SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", OPENROUTER_API_KEY: "synthetic-not-a-key", USERPROFILE: home };
    expect(minimalEnvironment(env, "win32")).toEqual({ PATH: "C:\\Tools", SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", USERPROFILE: home });
    expect(minimalEnvironment({ PATH: "/usr/bin", OTHER: "x" }, "darwin")).toEqual({ PATH: "/usr/bin", TMPDIR: undefined });
  });
  it("lists Windows container runtimes from Program Files and PATH", () => {
    expect(runtimeCandidates({ ProgramFiles: "C:\\Program Files", Path: "C:\\Tools;relative" }, "win32")).toEqual([
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe", "C:\\Program Files\\RedHat\\Podman\\podman.exe", "C:\\Tools\\docker.exe", "C:\\Tools\\podman.exe",
    ]);
  });
});

describe("Windows CLI shims", () => {
  it("spawns native executables directly and .cmd shims through a fixed cmd.exe", () => {
    expect(spawnPlan("C:\\Tools\\codex.exe", ["app-server"], "win32")).toEqual({ file: "C:\\Tools\\codex.exe", args: ["app-server"], verbatim: false });
    expect(spawnPlan("/opt/homebrew/bin/codex.cmd", ["x"], "darwin").verbatim).toBe(false);
    expect(spawnPlan(`${roaming}\\npm\\codex.cmd`, ["app-server", "--listen", "stdio://"], "win32", { SystemRoot: "C:\\Windows" })).toEqual({
      file: "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", `""${roaming}\\npm\\codex.cmd" "app-server" "--listen" "stdio://""`], verbatim: true,
    });
  });
  it.each([["quote", 'cli_auth_credentials_store="keyring"'], ["percent", "%PATH%"], ["delayed expansion", "!x!"], ["caret", "a^b"], ["newline", "a\nb"], ["trailing backslash", "C:\\dir\\"]])("refuses shim arguments containing a %s", (_name, arg) => {
    expect(() => spawnPlan(`${roaming}\\npm\\codex.cmd`, [arg], "win32")).toThrow("Provider process unavailable");
  });
  it("refuses relative shims and an untrusted SystemRoot", () => {
    expect(() => spawnPlan("codex.cmd", [], "win32")).toThrow("Provider process unavailable");
    // Drive-relative macOS paths would resolve to C:\bin, which any local account can create.
    for (const binary of ["/bin/ps", "/usr/bin/sandbox-exec", "\\bin\\ps.exe", "C:relative.exe"]) expect(() => spawnPlan(binary, [], "win32")).toThrow("Provider process unavailable");
    expect(spawnPlan("\\\\server\\share\\codex.exe", [], "win32").file).toBe("\\\\server\\share\\codex.exe");
    expect(spawnPlan("/bin/ps", ["-axo"], "darwin")).toEqual({ file: "/bin/ps", args: ["-axo"], verbatim: false });
    expect(systemBinary("cmd.exe", { SystemRoot: "C:\\Windows\"&calc" })).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(systemBinary("taskkill.exe", { SYSTEMROOT: "D:\\Win" })).toBe("D:\\Win\\System32\\taskkill.exe");
  });
});

describe("Windows desktop connections", () => {
  it("offers every desktop connection except a saved legacy Grok-via-Cursor source", async () => {
    const root = temp(), launch = { home: root, data: root, env: {}, demo: false, candidate: false, platform: "win32" as const };
    const prefs = await Preferences.load(launch, async () => { throw new Error("defaults must not run on Windows"); });
    const connections = new DesktopConnections(launch, prefs, join(root, "missing-helper"), () => {}, async () => { throw new Error("no helper may run"); });
    expect(connections.state.map(c => [c.provider, c.status])).toEqual([["codex", "disconnected"], ["claude", "disconnected"], ["antigravity", "disconnected"], ["grok", "disconnected"]]);
    await prefs.set("desktopGrokIdentity", "b".repeat(64));
    expect(connections.state.find(c => c.provider === "grok")?.status).toBe("unsupported"); expect(connections.enabled("grok")).toBe(false);
    await expect(connections.connect("grok", async () => {}, async () => true)).rejects.toThrow("Connection unavailable");
    await prefs.set("desktopGrokSource", "bot");
    expect(connections.state.find(c => c.provider === "grok")?.status).toBe("connected");
  });
});

describe("tray flyout placement", () => {
  const size = { width: 420, height: 700 };
  it("opens below a macOS menu bar, centered on the status item", () => {
    expect(flyoutOrigin({ x: 1000, y: 0, width: 24, height: 24 }, { x: 0, y: 25, width: 1440, height: 875 }, size)).toEqual({ x: 802, y: 25, bottom: false });
  });
  it("anchors above a bottom Windows taskbar and stays inside the work area", () => {
    expect(flyoutOrigin({ x: 1800, y: 1050, width: 24, height: 30 }, { x: 0, y: 0, width: 1920, height: 1040 }, size)).toEqual({ x: 1500, y: 340, bottom: true });
  });
  it("uses the top edge for a top Windows taskbar", () => {
    expect(flyoutOrigin({ x: 10, y: 0, width: 24, height: 30 }, { x: 0, y: 40, width: 1920, height: 1040 }, size)).toEqual({ x: 0, y: 40, bottom: false });
  });
});

// Real NTFS, real cmd.exe. These run on the Windows CI runner only.
describe.runIf(process.platform === "win32")("Windows runtime", () => {
  it("persists installed-app preferences as JSON and sets a damaged file aside", async () => {
    const root = temp(), data = join(root, "AppData", "Roaming", "MeterUsage");
    const launch = launchConfiguration([], { APPDATA: join(root, "AppData", "Roaming") }, root);
    expect(launch.data).toBe(data);
    const prefs = await Preferences.load(launch, async () => { throw new Error("defaults must not run on Windows"); });
    await prefs.set("refreshIntervalSeconds", 120); await prefs.set("sideNotchPanelEnabled", true);
    expect(JSON.parse(readFileSync(join(data, "preferences.json"), "utf8"))).toMatchObject({ refreshIntervalSeconds: 120, sideNotchPanelEnabled: true });
    expect((await Preferences.load(launch)).values).toMatchObject({ refreshIntervalSeconds: 120, sideNotchPanelEnabled: true });
    writeFileSync(join(data, "preferences.json"), "{damaged");
    expect((await Preferences.load(launch)).values.refreshIntervalSeconds).toBe(60);
    expect(existsSync(join(data, "preferences.json"))).toBe(false);
  });
  it("writes and reads API billing snapshots under roaming AppData", () => {
    const root = temp(), now = Date.parse("2026-10-16T12:00:00Z"), start = Date.parse("2026-10-01T00:00:00Z");
    const snapshot: ApiBillingSnapshot = { schema: 1, provider: "openai", capturedAt: now, monthStart: start, periodEnd: now, currency: "USD", daily: [{ start, end: start + 86400000, amountUSD: 1.25 }] };
    writeApiBilling(root, snapshot);
    expect(apiBillingPath(root, "openai")).toBe(join(root, "AppData", "Roaming", "MeterUsage", "api-usage", "openai.json"));
    expect(readApiBilling(root, "openai", now + 60000)).toEqual({ status: "value", value: snapshot, stale: false });
  });
  it("reads Claude transcripts under backslash-separated project folders", async () => {
    const root = temp(), project = join(root, "C--Users-testuser-fixture-project"); mkdirSync(project);
    writeFileSync(join(project, "session.jsonl"), JSON.stringify({ type: "assistant", timestamp: new Date().toISOString(), message: { model: "claude-sonnet-4-6", usage: { output_tokens: 7 } } }) + "\n");
    const activity = await new ClaudeActivitySource(root).scan();
    expect(activity.sessions).toHaveLength(1); expect(activity.sessions[0].tokens.output).toBe(7);
  });
  it("finds an npm .cmd shim and runs it without a console window or shell", async () => {
    const root = temp(), npm = join(root, "AppData", "Roaming", "npm"); mkdirSync(npm, { recursive: true });
    // Same shape as an npm shim: forward %* to a Node script.
    writeFileSync(join(npm, "fixture-cli.cmd"), `@"${process.execPath}" -e "console.log(JSON.stringify(process.argv.slice(1)))" %*\r\n`);
    const binary = cliPath("fixture-cli", root, { APPDATA: join(root, "AppData", "Roaming"), Path: "" });
    expect(binary).toBe(join(npm, "fixture-cli.cmd"));
    expect(JSON.parse(await runCommand(binary, ["app-server", "--listen", "stdio://"], { env: process.env, timeoutMs: 10000 }))).toEqual(["app-server", "--listen", "stdio://"]);
    expect(JSON.parse(await runCommand(binary, ["a&b|c>d"], { env: process.env, timeoutMs: 10000 }))).toEqual(["a&b|c>d"]);
    await expect(runCommand(binary, ["%PATH%"], { env: process.env })).rejects.toThrow("Provider process unavailable");
  });
  it("runs an npm-format shim through node directly, so quoted Codex arguments pass unchanged", async () => {
    const root = temp(), npm = join(root, "AppData", "Roaming", "npm"), pkg = join(npm, "node_modules", "fixture-cli", "bin"); mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "cli.js"), "console.log(JSON.stringify(process.argv.slice(2)))\n");
    writeFileSync(join(npm, "fixture-cli.cmd"), '@ECHO off\r\nGOTO start\r\n:find_dp0\r\nSET dp0=%~dp0\r\nEXIT /b\r\n:start\r\nSETLOCAL\r\nCALL :find_dp0\r\nIF EXIST "%dp0%\\node.exe" ( SET "_prog=%dp0%\\node.exe" ) ELSE ( SET "_prog=node" )\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\fixture-cli\\bin\\cli.js" %*\r\n');
    const env = { ...process.env, Path: dirname(process.execPath) }, args = ["-c", 'cli_auth_credentials_store="keyring"', "%PATH%", "a&b"];
    expect(JSON.parse(await runCommand(join(npm, "fixture-cli.cmd"), args, { env, timeoutMs: 10000 }))).toEqual(args);
  });
  it("refuses an npm-style shim whose script leaves node_modules and falls back to the strict cmd.exe rules", async () => {
    const root = temp(), npm = join(root, "npm"); mkdirSync(join(npm, "node_modules"), { recursive: true });
    writeFileSync(join(root, "outside.js"), "console.log('must not run')\n");
    writeFileSync(join(npm, "escape.cmd"), '@"%dp0%\\node.exe" "%dp0%\\node_modules\\..\\..\\outside.js" %*\r\n');
    await expect(runCommand(join(npm, "escape.cmd"), ['quoted="arg"'], { env: process.env, timeoutMs: 10000 })).rejects.toThrow("Provider process unavailable");
  });
  it("runs the fixed Antigravity discovery script and finds no language server on the runner", async () => {
    const output = await runCommand(powershell(), powershellArgs(windowsDiscoveryScript), { env: process.env, timeoutMs: 60000 });
    expect(JSON.parse(output.trim() || "[]")).toEqual([]);
  });
  it("unwraps a real DPAPI-protected Local State key through the PowerShell helper", async () => {
    const root = temp(), key = randomBytes(32);
    const protect = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $d=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); [Console]::Out.Write([Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect($d,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)))";
    const wrapped = Buffer.from((await runCommand(powershell(), powershellArgs(protect), { env: process.env, timeoutMs: 30000, input: key.toString("base64") })).trim(), "base64");
    writeFileSync(join(root, "Local State"), JSON.stringify({ os_crypt: { encrypted_key: Buffer.concat([Buffer.from("DPAPI"), wrapped]).toString("base64") } }));
    expect((await chromiumKey(join(root, "Local State"), dpapiUnprotect(runCommand, process.env))).equals(key)).toBe(true);
  });
  it("connects Claude Desktop from roaming AppData with the Windows key", async () => {
    const home = temp(), roaming = join(home, "AppData", "Roaming"), claude = join(roaming, "Claude"); mkdirSync(join(claude, "Network"), { recursive: true });
    const key = randomBytes(32), wrapped = Buffer.from("synthetic-wrapped-key"), account = "11111111-1111-1111-1111-111111111111", org = "22222222-2222-2222-2222-222222222222", now = Date.now();
    writeFileSync(join(claude, "Local State"), JSON.stringify({ os_crypt: { encrypted_key: Buffer.concat([Buffer.from("DPAPI"), wrapped]).toString("base64") } }));
    writeFileSync(join(claude, "config.json"), JSON.stringify({ lastKnownAccountUuid: account }));
    const seal = (name: string, value: string) => { const nonce = randomBytes(12), c = createCipheriv("aes-256-gcm", key, nonce), body = Buffer.concat([c.update(Buffer.concat([createHash("sha256").update(".claude.ai").digest(), Buffer.from(value)])), c.final()]); return Buffer.concat([Buffer.from("v10"), nonce, body, c.getAuthTag()]); };
    const db = new DatabaseSync(join(claude, "Network", "Cookies"));
    db.exec("CREATE TABLE meta(key TEXT, value TEXT); INSERT INTO meta VALUES('version','24'); CREATE TABLE cookies(host_key TEXT, name TEXT, path TEXT, is_secure INTEGER, is_httponly INTEGER, expires_utc INTEGER, encrypted_value BLOB)");
    const expires = (BigInt(now) + 11644473600000n) * 1000n + 3600000000n;
    for (const [name, value, httpOnly] of [["sessionKey", "synthetic-session", 1], ["lastActiveOrg", org, 0]] as const) db.prepare("INSERT INTO cookies VALUES ('.claude.ai', ?, '/', 1, ?, ?, ?)").run(name, httpOnly, expires, seal(name, value));
    db.close();
    const launch = { home, data: join(roaming, "MeterUsage"), env: { ...process.env, APPDATA: roaming }, demo: false, candidate: false, platform: "win32" as const };
    const prefs = await Preferences.load(launch);
    const http = async (url: string) => url.endsWith("/bootstrap") ? JSON.stringify({ account: { uuid: account, memberships: [{ organization: { uuid: org } }] } }) : JSON.stringify({ five_hour: { utilization: 12, resets_at: new Date(now + 3600000).toISOString() } });
    const unprotect = async (data: Buffer) => { if (!data.equals(wrapped)) throw new Error("fake DPAPI"); return Buffer.from(key); };
    const connections = new DesktopConnections(launch, prefs, "C:\\missing-helper.exe", () => {}, async () => { throw new Error("no subprocess"); }, http as never, () => now, undefined, undefined, unprotect);
    expect(await connections.connect("claude", async () => {}, async () => true)).toBe(true);
    expect(connections.state.find(c => c.provider === "claude")?.status).toBe("connected");
    expect((await connections.quota("claude")).windows[0]).toMatchObject({ usedPercent: 12 });
  });
  it("ends a shim's whole process tree on timeout", async () => {
    const root = temp(), shim = join(root, "slow.cmd");
    writeFileSync(shim, "@echo off\r\nping -n 30 127.0.0.1 > nul\r\n");
    const started = Date.now();
    await expect(runCommand(shim, [], { env: process.env, timeoutMs: 500 })).rejects.toThrow("Provider request timed out");
    expect(Date.now() - started).toBeLessThan(10000);
  });
});
