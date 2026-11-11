import { expect, it } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Project knowledge is split into docs/KB.md and docs/kb/*.md so each file can be read whole.
const files = ["docs/KB.md", ...readdirSync("docs/kb").filter(f => f.endsWith(".md")).map(f => `docs/kb/${f}`)];

it("keeps each knowledge file under 64 KiB", () => {
  for (const file of files) expect(readFileSync(file).length, file).toBeLessThan(65536);
});

it("resolves every relative link in the knowledge files", () => {
  for (const file of files) {
    for (const [, target] of readFileSync(file, "utf8").matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const path = join(dirname(file), decodeURI(target.split("#")[0]));
      expect(existsSync(path), `${file} -> ${target}`).toBe(true);
    }
  }
});
