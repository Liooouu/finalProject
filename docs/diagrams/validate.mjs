// Structural check: every edge references a vertex that exists in the same page,
// and no id is duplicated inside a page.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let failed = 0;

for (const file of readdirSync(HERE).filter((f) => f.endsWith(".drawio"))) {
  const xml = readFileSync(join(HERE, file), "utf8");
  const pages = xml.split(/<diagram\b/).slice(1);
  pages.forEach((page, index) => {
    const ids = [...page.matchAll(/<mxCell id="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    const edges = [...page.matchAll(/<mxCell id="([^"]+)"[^>]*edge="1"[^>]*source="([^"]+)"[^>]*target="([^"]+)"/g)];
    const dangling = edges.filter(([, , s, t]) => !ids.includes(s) || !ids.includes(t));
    const label = (page.match(/name="([^"]*)"/) || [])[1] || `page ${index + 1}`;
    const ok = dupes.length === 0 && dangling.length === 0;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${file} :: ${label} — ${ids.length} cells, ${edges.length} edges` +
        (dupes.length ? ` | duplicate ids: ${dupes.join(", ")}` : "") +
        (dangling.length ? ` | dangling: ${dangling.map((e) => e[0]).join(", ")}` : "")
    );
  });
}

process.exit(failed ? 1 : 0);
