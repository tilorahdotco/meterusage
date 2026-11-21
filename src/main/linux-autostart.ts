import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { supportRoot } from "./platform";

// Electron's login item API covers macOS and Windows only. Linux desktops start
// entries in the XDG autostart folder (freedesktop Desktop Application Autostart).
export const autostartPath = (home: string, env: NodeJS.ProcessEnv) => posix.join(supportRoot(home, "linux", env), "autostart", "dev.meterusage.app.desktop");

/** The program to start at login: the AppImage file when running from one, otherwise the installed executable. */
export function autostartExecutable(exe: string, env: NodeJS.ProcessEnv) {
  const image = env.APPIMAGE;
  return image && posix.isAbsolute(image) && existsSync(image) ? image : exe;
}

// Exec quoting needs escapes for these characters, and % starts a field code.
// Refuse them instead, so a path can never change the command.
const unsafeExec = /["`$\\%\x00-\x1f\x7f]/;
export function autostartEntry(executable: string) {
  if (!posix.isAbsolute(executable) || unsafeExec.test(executable)) throw new Error("Could not change login item");
  return ["[Desktop Entry]", "Type=Application", "Name=MeterUsage", "Comment=AI usage limits in the system tray", `Exec="${executable}"`, "Terminal=false", "X-GNOME-Autostart-enabled=true", ""].join("\n");
}

export function autostartEnabled(home: string, env: NodeJS.ProcessEnv) { return existsSync(autostartPath(home, env)); }

export function setAutostart(home: string, env: NodeJS.ProcessEnv, enabled: boolean, executable: string) {
  const path = autostartPath(home, env);
  if (!enabled) { rmSync(path, { force: true }); return; }
  const entry = autostartEntry(executable), temp = posix.join(posix.dirname(path), `.${randomUUID()}.tmp`);
  mkdirSync(posix.dirname(path), { recursive: true, mode: 0o700 });
  try { writeFileSync(temp, entry, { mode: 0o644, flag: "wx" }); renameSync(temp, path); }
  catch { rmSync(temp, { force: true }); throw new Error("Could not change login item"); }
}
