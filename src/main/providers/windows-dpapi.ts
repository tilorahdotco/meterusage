import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { selectJSON } from "../select-json";
import { object } from "./parsers";
import { runCommand, type Command } from "./transport";
import { envValue, minimalEnvironment } from "../platform";

// Chromium and Electron apps on Windows keep a random AES-256 key in "Local State",
// wrapped with the user's DPAPI key and prefixed "DPAPI". Values are "v10" + 12-byte
// nonce + AES-256-GCM ciphertext + 16-byte tag. "v20" (app-bound) values are refused.
export type Decrypt = (bytes: Uint8Array) => Buffer;
/** Unwraps DPAPI-protected bytes for the current Windows user. A test seam; production uses PowerShell. */
export type Unprotect = (data: Buffer, signal?: AbortSignal) => Promise<Buffer>;
const invalid = () => new Error("Windows protected data unavailable");

export const powershell = (env: NodeJS.ProcessEnv = process.env) => {
  const root = envValue(env, "SystemRoot", "win32");
  return `${root && /^[A-Za-z]:\\[^"%!]*$/.test(root) ? root : "C:\\Windows"}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
};
export const powershellArgs = (script: string) => ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script];
// Fixed script. Protected bytes arrive on stdin and plaintext leaves on stdout; neither appears in arguments.
export const unprotectScript = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $d=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()); $p=[System.Security.Cryptography.ProtectedData]::Unprotect($d,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($p))";
export function dpapiUnprotect(command: Command = runCommand, env: NodeJS.ProcessEnv = process.env): Unprotect {
  return async (data, signal) => {
    if (data.length < 1 || data.length > 65536) throw invalid();
    // A minimal environment keeps user module paths from shadowing the fixed cmdlets.
    const output = (await command(powershell(env), powershellArgs(unprotectScript), { env: minimalEnvironment(env, "win32"), signal, timeoutMs: 15000, maxBytes: 8192, input: data.toString("base64") })).trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(output)) throw invalid();
    return Buffer.from(output, "base64");
  };
}

/** Reads a bounded regular file without following a link, and requires it to be unchanged by the read. */
export function readStableFile(path: string, maxBytes: number): string {
  const link = lstatSync(path);
  if (link.isSymbolicLink() || !link.isFile() || link.size > maxBytes) throw invalid();
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    if (stat.ino !== link.ino || stat.dev !== link.dev || !stat.isFile() || stat.size > maxBytes) throw invalid();
    const bytes = Buffer.alloc(maxBytes + 1); let length = 0, count: number;
    do { count = readSync(fd, bytes, length, bytes.length - length, null); length += count; } while (count && length < bytes.length);
    const after = fstatSync(fd);
    if (length > maxBytes || length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw invalid();
    return bytes.subarray(0, length).toString("utf8");
  } finally { closeSync(fd); }
}

/** Unwraps the app's AES key from its Local State file. Only os_crypt.encrypted_key is selected. */
export async function chromiumKey(localState: string, unprotect: Unprotect, signal?: AbortSignal): Promise<Buffer> {
  const raw = readStableFile(localState, 8 * 1048576);
  const encoded = object(object(selectJSON(raw, { os_crypt: { encrypted_key: true } }, undefined, true)).os_crypt).encrypted_key;
  if (typeof encoded !== "string" || encoded.length > 8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw invalid();
  const wrapped = Buffer.from(encoded, "base64");
  if (wrapped.subarray(0, 5).toString("latin1") !== "DPAPI") throw invalid();
  signal?.throwIfAborted();
  const key = await unprotect(wrapped.subarray(5), signal);
  if (key.length !== 32) { key.fill(0); throw invalid(); }
  return key;
}

export function decryptChromiumWindows(bytes: Uint8Array, key: Buffer): Buffer {
  const input = Buffer.from(bytes);
  if (input.length < 3 + 12 + 16 || input.length > 1048576 || input.subarray(0, 3).toString("latin1") !== "v10") throw invalid();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, input.subarray(3, 15));
    decipher.setAuthTag(input.subarray(input.length - 16));
    return Buffer.concat([decipher.update(input.subarray(15, input.length - 16)), decipher.final()]);
  } catch { throw invalid(); }
}
