import { accessSync, closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { Unavailable, failed, type Quota } from "../../domain/models";
import { pathFor, systemBinary, windowsSearchPath, type Platform } from "../platform";
import { parseAntigravity } from "./parsers";
import { cliEnvironment, runCommand, type Command } from "./transport";

const name = "Native Antigravity";
const limits = { timeoutMs: 30000, maxBytes: 1048576 };
// The native CLI documents print-mode slash commands in its changelog. Older builds would treat "/usage" as a model prompt.
const gate = ["non-interactive answers for the read-only slash commands in print mode", "/usage", "without starting an agent turn"];

/** Candidate agy paths in priority order. Pure; probes nothing. */
export function antigravityCliCandidates(home: string, env: NodeJS.ProcessEnv, platform: Platform = process.platform): string[] {
  const path = pathFor(platform), list: string[] = [];
  if (platform === "win32") {
    for (const dir of windowsSearchPath(cliEnvironment(home, env, "win32"))) list.push(path.join(dir, "agy.exe"));
  } else {
    list.push(path.join(home, ".local/share/antigravity/bin/agy"), "/opt/homebrew/bin/agy", "/usr/local/bin/agy", path.join(home, ".local/bin/agy"));
    for (const dir of (env.PATH ?? "/usr/bin:/bin").split(":")) if (path.isAbsolute(dir)) list.push(path.join(dir, "agy"));
  }
  return [...new Set(list)];
}

/** True for a regular executable file whose header is a native ELF, Mach-O, fat Mach-O or PE image. Never executes it. */
export function isNativeExecutable(file: string, platform: Platform = process.platform): boolean {
  let fd: number | undefined;
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) return false;
    if (platform !== "win32") accessSync(file, constants.X_OK);
    const head = Buffer.alloc(4), read = readSync(fd, head, 0, 4, 0);
    if (read < 4) return false;
    if (platform === "win32") return head[0] === 0x4d && head[1] === 0x5a;
    const magic = head.toString("hex");
    return magic === "7f454c46" || ["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe", "bebafeca"].includes(magic);
  } catch { return false; }
  finally { if (fd !== undefined) try { closeSync(fd); } catch { /* Already closed. */ } }
}

// agy must never open a browser for sign-in during a background refresh.
function environment(home: string, env: NodeJS.ProcessEnv, platform: Platform): NodeJS.ProcessEnv {
  const browser = platform === "win32" ? `"${systemBinary("cmd.exe", env)}" /d /c exit 1` : "/usr/bin/false";
  return { ...cliEnvironment(home, env, platform), BROWSER: browser, AGY_CLI_DISABLE_AUTO_UPDATE: "true" };
}

/** Reads the native Antigravity CLI /usage output. The CLI owns authentication; no secret store is opened here. */
export async function nativeAntigravityQuota(home: string, env: NodeJS.ProcessEnv, command: Command = runCommand, now = Date.now(), signal?: AbortSignal, platform: Platform = process.platform): Promise<Quota> {
  if (signal?.aborted) throw new Error("Provider request cancelled");
  const binary = antigravityCliCandidates(home, env, platform).find(candidate => isNativeExecutable(candidate, platform));
  if (!binary) throw new Unavailable("cliNotFound", name);
  const options = { env: environment(home, env, platform), signal, ...limits };
  const run = async (args: string[]) => {
    try {
      const output = await command(binary, args, options);
      if (signal?.aborted) throw new Error("Provider request cancelled");
      return output;
    } catch { if (signal?.aborted) throw new Error("Provider request cancelled"); throw failed("antigravity"); }
  };
  const changelog = (await run(["changelog"])).toLowerCase();
  if (!changelog.split(/\r?\n/).some(entry => gate.every(phrase => entry.includes(phrase)))) throw new Unavailable("failed", "Antigravity CLI; update the native CLI");
  const output = await run(["-p", "/usage"]);
  try { return parseAntigravity(output, now); }
  catch (error) { throw error instanceof Unavailable ? error : failed("antigravity"); }
}
