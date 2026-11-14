import { afterEach, describe, expect, it } from "vite-plus/test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Unavailable } from "../src/domain/models";
import { antigravityCliCandidates, isNativeExecutable, nativeAntigravityQuota } from "../src/main/providers/antigravity-cli";
import type { Command } from "../src/main/providers/transport";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const ELF = Buffer.from("7f454c460201010000000000", "hex");
const native = process.platform === "win32" ? Buffer.from("4d5a000000000000", "hex") : ELF;
function home() { const root = mkdtempSync(join(tmpdir(), "agy-cli-")); roots.push(root); return root; }
function install(root: string, content: Buffer | string, mode = 0o755) {
  const dir = join(root, process.platform === "win32" ? ".local/bin" : ".local/share/antigravity/bin"); mkdirSync(dir, { recursive: true });
  const file = join(dir, process.platform === "win32" ? "agy.exe" : "agy"); writeFileSync(file, content); chmodSync(file, mode); return file;
}
const changelog = "- Added non-interactive answers for the read-only slash commands in print mode: /usage prints quota without starting an agent turn\n";
const usage = "Gemini\tFive Hour Limit Remaining\t80%\t2026-11-14T12:00:00Z\nClaude and GPT\tWeekly Limit Remaining\t50%\t2026-11-20T12:00:00Z\n";
const env = { PATH: "/nonexistent" } as NodeJS.ProcessEnv;

describe("native Antigravity CLI quota", () => {
  it("parses /usage after the changelog gate and uses a safe environment", async () => {
    const root = home(), file = install(root, native), calls: { binary: string; args: string[]; env?: NodeJS.ProcessEnv; timeoutMs?: number; maxBytes?: number }[] = [];
    const command: Command = async (binary, args, options) => { calls.push({ binary, args, env: options?.env, timeoutMs: options?.timeoutMs, maxBytes: options?.maxBytes }); return args[0] === "changelog" ? changelog : usage; };
    const quota = await nativeAntigravityQuota(root, env, command, 0);
    expect(quota.windows.length).toBe(2);
    expect(calls.map(c => [c.binary, c.args])).toEqual([[file, ["changelog"]], [file, ["-p", "/usage"]]]);
    for (const call of calls) {
      expect(call.env?.BROWSER).toBe(process.platform === "win32" ? '"C:\\Windows\\System32\\cmd.exe" /d /c exit 1' : "/usr/bin/false");
      expect(call.env?.AGY_CLI_DISABLE_AUTO_UPDATE).toBe("true");
      expect(call.timeoutMs).toBe(30000);
      expect(call.maxBytes).toBe(1048576);
    }
  });
  it("never runs -p when the changelog lacks the documented entry", async () => {
    const root = home(); install(root, native);
    const calls: string[][] = [];
    const command: Command = async (_b, args) => { calls.push(args); return "- unrelated\n"; };
    await expect(nativeAntigravityQuota(root, env, command, 0)).rejects.toMatchObject({ code: "failed", subject: "Antigravity CLI; update the native CLI" });
    expect(calls).toEqual([["changelog"]]);
  });
  it("sanitizes command failures into Unavailable without leaking details", async () => {
    const root = home(); install(root, native);
    const command: Command = async () => { throw new Error("secret-token /home/x"); };
    const error = await nativeAntigravityQuota(root, env, command, 0).catch(e => e);
    expect(error).toBeInstanceOf(Unavailable);
    expect(error.code).toBe("failed");
    expect(error.message).not.toContain("secret");
    const second = await nativeAntigravityQuota(root, env, (async (_b, a) => a[0] === "changelog" ? changelog : "garbage") as Command, 0).catch(e => e);
    expect(second).toBeInstanceOf(Unavailable);
  });
  it("propagates the signal and rethrows cancellation", async () => {
    const root = home(); install(root, native);
    const controller = new AbortController(); let seen: AbortSignal | undefined;
    const command: Command = async (_b, _a, options) => { seen = options?.signal; controller.abort(); throw new Error("synthetic-private-error"); };
    await expect(nativeAntigravityQuota(root, env, command, 0, controller.signal)).rejects.toThrow("cancelled");
    expect(seen).toBe(controller.signal);
  });
  it("skips shell wrappers without executing them", async () => {
    const root = home(); install(root, "#!/bin/sh\nexec docker run agy\n");
    let called = false;
    await expect(nativeAntigravityQuota(root, env, async () => { called = true; return ""; }, 0)).rejects.toMatchObject({ code: "cliNotFound", subject: "Native Antigravity" });
    expect(called).toBe(false);
  });
  it("accepts only regular executable native headers", () => {
    const root = home(), file = install(root, native);
    expect(isNativeExecutable(file)).toBe(true);
    for (const magic of ["cffaedfe", "cafebabe"]) { writeFileSync(file, Buffer.from(magic + "00000000", "hex")); expect(isNativeExecutable(file, "darwin")).toBe(true); }
    writeFileSync(file, "#!/bin/sh\n"); expect(isNativeExecutable(file, "linux")).toBe(false);
    writeFileSync(file, ELF);
    if (process.platform !== "win32") { chmodSync(file, 0o644); expect(isNativeExecutable(file, "linux")).toBe(false); }
    expect(isNativeExecutable(join(root, ".local"), "linux")).toBe(false);
    expect(isNativeExecutable(join(root, "missing"), "linux")).toBe(false);
  });
  it("rejects support phrases from unrelated changelog records", async () => {
    const root = home(); install(root, native); const calls: string[][] = [];
    const command: Command = async (_b, args) => {
      calls.push(args);
      return "Added non-interactive answers for the read-only slash commands in print mode: /help without starting an agent turn\nAn unrelated change to /usage";
    };
    await expect(nativeAntigravityQuota(root, env, command, 0)).rejects.toMatchObject({ code: "failed" });
    expect(calls).toEqual([["changelog"]]);
  });
  it("skips a shell wrapper and continues to a later native candidate", async () => {
    const root = home(); install(root, "#!/bin/sh\nexec podman run agy\n");
    const later = join(root, "native-bin"); mkdirSync(later);
    const file = join(later, process.platform === "win32" ? "agy.exe" : "agy"); writeFileSync(file, native, { mode: 0o755 });
    const calls: string[] = [];
    await nativeAntigravityQuota(root, { PATH: later }, async (binary, args) => { calls.push(binary); return args[0] === "changelog" ? changelog : usage; }, 0);
    expect(calls).toEqual([file, file]);
  });
  it.skipIf(process.platform === "win32")("rejects a FIFO without opening it for a blocking read", () => {
    const root = home(), fifo = join(root, "fifo");
    execFileSync("mkfifo", [fifo]);
    expect(isNativeExecutable(fifo)).toBe(false);
  });
  it.each(["changelog", "-p"])("sanitizes %s timeout and output-limit failures", async stage => {
    const root = home(); install(root, native);
    for (const reason of ["Provider request timed out", "Provider output exceeded limit"]) {
      const calls: string[][] = [];
      await expect(nativeAntigravityQuota(root, env, async (_b, args) => { calls.push(args); if (args[0] === stage) throw new Error(reason); return changelog; }, 0)).rejects.toMatchObject({ code: "failed" });
      expect(calls).toHaveLength(stage === "changelog" ? 1 : 2);
    }
  });
  it("does not start a command for an already cancelled refresh", async () => {
    const root = home(); install(root, native); const controller = new AbortController(); controller.abort(); let calls = 0;
    await expect(nativeAntigravityQuota(root, env, async () => { calls++; return changelog; }, 0, controller.signal)).rejects.toThrow();
    expect(calls).toBe(0);
  });
  it("orders candidates and uses agy.exe on Windows", () => {
    const posix = antigravityCliCandidates("/h", { PATH: "/a:rel:/b" } as NodeJS.ProcessEnv, "linux");
    expect(posix.slice(0, 4)).toEqual(["/h/.local/share/antigravity/bin/agy", "/opt/homebrew/bin/agy", "/usr/local/bin/agy", "/h/.local/bin/agy"]);
    expect(posix.slice(4)).toEqual(["/a/agy", "/b/agy"]);
    const win = antigravityCliCandidates("C:\\Users\\u", { Path: "C:\\Tools", APPDATA: "C:\\Users\\u\\AppData\\Roaming" } as NodeJS.ProcessEnv, "win32");
    expect(win.every(p => p.endsWith("\\agy.exe"))).toBe(true);
    expect(win).toContain("C:\\Tools\\agy.exe");
  });
});
