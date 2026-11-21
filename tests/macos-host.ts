import { afterAll } from "vite-plus/test";

/**
 * For test files whose fixtures model the macOS shell (defaults domain, app bundles, Application Support).
 * On a Linux host, process.platform would select the Linux branches instead; linux.test.ts covers those.
 * Call at module scope: the platform changes at once and returns when the file finishes.
 */
export function modelMacOSHost() {
  if (process.platform !== "linux") return;
  const original = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  afterAll(() => { Object.defineProperty(process, "platform", original); });
}
