import { expect, it } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Project knowledge is split into docs/KB.md and docs/kb/**/*.md so each file can be read whole.
const root = fileURLToPath(new URL("..", import.meta.url));
const topics = readdirSync(join(root, "docs/kb"), { recursive: true, encoding: "utf8" }).filter(f => f.endsWith(".md"));
const files = ["docs/KB.md", ...topics.map(f => join("docs/kb", f))];

it("keeps each knowledge file under 64 KiB", () => {
  for (const file of files) expect(readFileSync(join(root, file)).length, file).toBeLessThan(65536);
});

// Supported form: [text](target), [text](<target>) or [text](target "title"). Any other "](" fails,
// so an unsupported link is reported instead of skipped.
const link = /\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/y;
it("resolves every relative link in the knowledge files", () => {
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (let at = text.indexOf("]("); at !== -1; at = text.indexOf("](", at + 2)) {
      link.lastIndex = at;
      const match = link.exec(text);
      expect(match, `${file}: unsupported link syntax near ${JSON.stringify(text.slice(at, at + 60))}`).not.toBeNull();
      const target = match![1] ?? match![2];
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      let path = "";
      try { path = join(root, dirname(file), decodeURI(target.split("#")[0])); } catch { /* reported below */ }
      expect(path !== "" && existsSync(path), `${file} -> ${target}`).toBe(true);
    }
  }
});
