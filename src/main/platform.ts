import { posix, win32 } from "node:path";
import type { Stats } from "node:fs";

// Platform seams for the Electron main process. Each helper takes the platform
// explicitly so Linux and macOS test runs can exercise the Windows branches.
export type Platform = NodeJS.Platform;
export const pathFor = (platform: Platform) => platform === "win32" ? win32 : posix;

/** Windows environment names are case-insensitive; a copied process.env keeps the original casing ("Path"). */
export function envKey(env: NodeJS.ProcessEnv, name: string, platform: Platform = process.platform): string | undefined {
  if (platform !== "win32") return Object.hasOwn(env, name) ? name : undefined;
  const upper = name.toUpperCase();
  return Object.keys(env).find(key => key.toUpperCase() === upper);
}
export function envValue(env: NodeJS.ProcessEnv, name: string, platform: Platform = process.platform): string | undefined {
  const key = envKey(env, name, platform);
  return key === undefined ? undefined : env[key];
}
/** Copies env and sets one variable, replacing any differently cased Windows duplicate. */
export function withEnvValue(env: NodeJS.ProcessEnv, name: string, value: string, platform: Platform = process.platform): NodeJS.ProcessEnv {
  const next = { ...env };
  if (platform === "win32") for (const key of Object.keys(next)) if (key.toUpperCase() === name.toUpperCase()) delete next[key];
  next[platform === "win32" ? envKey(env, name, platform) ?? name : name] = value;
  return next;
}

/** True when child is parent or below it. Handles Windows separators, drive changes and case. */
export function within(parent: string, child: string, platform: Platform = process.platform): boolean {
  const path = pathFor(platform), inside = path.relative(parent, child);
  return inside === "" || !path.isAbsolute(inside) && inside.split(path.sep)[0] !== "..";
}

// %APPDATA% can be redirected away from the profile. Use it only when it stays
// under the given home, so isolated homes in tests and demo never reach the real profile.
function windowsFolder(home: string, env: NodeJS.ProcessEnv, name: "APPDATA" | "LOCALAPPDATA"): string {
  const configured = envValue(env, name, "win32");
  if (configured && win32.isAbsolute(configured) && within(home, win32.resolve(configured), "win32")) return win32.resolve(configured);
  return win32.join(home, "AppData", name === "APPDATA" ? "Roaming" : "Local");
}
/** Per-user application data root: Application Support on macOS, roaming AppData on Windows. */
export function supportRoot(home: string, platform: Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string {
  return platform === "win32" ? windowsFolder(home, env, "APPDATA") : posix.join(home, "Library/Application Support");
}
/** Machine-local per-user data root. Windows apps keep caches and some configuration under %LOCALAPPDATA%. */
export function localRoot(home: string, platform: Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string {
  return platform === "win32" ? windowsFolder(home, env, "LOCALAPPDATA") : posix.join(home, "Library/Application Support");
}
export const appDataDirectory = (home: string, platform: Platform = process.platform, env: NodeJS.ProcessEnv = process.env) => pathFor(platform).join(supportRoot(home, platform, env), "MeterUsage");

// POSIX owner and mode checks. Windows stat has no owner and synthesizes mode
// bits from the read-only attribute, so per-user profile ACLs are the boundary
// there (ADR 0038). Symlink, file type, link count and size checks still apply.
export const ownedByUser = (stat: Stats, platform: Platform = process.platform) => platform === "win32" || stat.uid === process.getuid?.();
export const modeExposes = (stat: Stats, mask: number, platform: Platform = process.platform) => platform !== "win32" && (stat.mode & mask) !== 0;

const childKeys = { darwin: ["PATH", "TMPDIR"], win32: ["PATH", "PATHEXT", "SystemRoot", "SystemDrive", "windir", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH"] };
/** Minimal environment for isolated provider subprocesses. Windows programs need SystemRoot and profile folders to start. */
export function minimalEnvironment(env: NodeJS.ProcessEnv, platform: Platform = process.platform): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const name of platform === "win32" ? childKeys.win32 : childKeys.darwin) {
    const key = envKey(env, name, platform);
    // Keep the existing { PATH, TMPDIR } shape on macOS, including absent values.
    if (platform !== "win32") result[name] = key === undefined ? undefined : env[key];
    else if (key !== undefined && env[key] !== undefined) result[name] = env[key];
  }
  return result;
}

/** Fixed Windows system binaries; never resolved through PATH. */
export function systemBinary(name: "cmd.exe" | "taskkill.exe", env: NodeJS.ProcessEnv = process.env): string {
  const root = envValue(env, "SystemRoot", "win32");
  return win32.join(root && /^[A-Za-z]:\\[^"%!]*$/.test(root) ? root : "C:\\Windows", "System32", name);
}

// Node refuses to spawn .cmd/.bat files without a shell (CVE-2024-27980), and
// npm installs CLIs as .cmd shims. Run those through cmd.exe only with
// arguments that need no escaping inside double quotes.
const unsafeShimText = /["%!^\r\n\0]/;
export interface SpawnPlan { file: string; args: string[]; verbatim: boolean }
export function spawnPlan(binary: string, args: string[], platform: Platform = process.platform, env: NodeJS.ProcessEnv = process.env): SpawnPlan {
  if (platform !== "win32" || !/\.(?:cmd|bat)$/i.test(binary)) return { file: binary, args, verbatim: false };
  if (!win32.isAbsolute(binary) || unsafeShimText.test(binary) || args.some(arg => unsafeShimText.test(arg) || arg.endsWith("\\"))) throw new Error("Provider process unavailable");
  // /s keeps everything between the outer quotes verbatim; each argument stays quoted for the shim's %*.
  return { file: systemBinary("cmd.exe", env), args: ["/d", "/s", "/c", `"${[binary, ...args].map(arg => `"${arg}"`).join(" ")}"`], verbatim: true };
}
