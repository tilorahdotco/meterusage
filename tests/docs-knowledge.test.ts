import { expect, it } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Project knowledge is split into docs/KB.md and docs/kb/*.md so each file can be read whole.
const root = fileURLToPath(new URL("..", import.meta.url));
const files = ["docs/KB.md", ...readdirSync(join(root, "docs/kb")).filter(f => f.endsWith(".md")).map(f => `docs/kb/${f}`)];

it("keeps each knowledge file under 64 KiB", () => {
  for (const file of files) expect(readFileSync(join(root, file)).length, file).toBeLessThan(65536);
});

// Inline links only: [text](target), [text](<target>) and [text](target "title").
it("resolves every relative link in the knowledge files", () => {
  for (const file of files) {
    for (const [, angled, plain] of readFileSync(join(root, file), "utf8").matchAll(/\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g)) {
      const target = angled ?? plain;
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const path = join(root, dirname(file), decodeURI(target.split("#")[0]));
      expect(existsSync(path), `${file} -> ${target}`).toBe(true);
    }
  }
});
