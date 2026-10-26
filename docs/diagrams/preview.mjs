// Builds docs/diagrams/preview.html — a local page that renders every .drawio
// file with the draw.io viewer. Open it directly in a browser, or use
// preview.html?only=3 to render a single diagram.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE)
  .filter((f) => /^\d{2}-.*\.drawio$/.test(f))
  .sort();

const attr = (json) =>
  json
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const cards = files
  .map((file, i) => {
    const xml = readFileSync(join(HERE, file), "utf8");
    const config = attr(
      JSON.stringify({
        xml,
        border: 20,
        nav: false,
        resize: true,
        toolbar: "",
        "auto-fit": true,
        "fit-page": true,
      })
    );
    const title = file.replace(/^\d{2}-/, "").replace(/\.drawio$/, "").replace(/-/g, " ");
    return `  <section class="card" data-index="${i}">
    <h2>${i + 1}. ${title}</h2>
    <div class="mxgraph" data-mxgraph="${config}"></div>
  </section>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>TrackED — diagram preview</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; background: #eef1f5; font-family: Inter, Segoe UI, Arial, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #111827; }
  p.note { margin: 0 0 20px; font-size: 13px; color: #4b5563; }
  section.card { background: #fff; border: 1px solid #d1d5db; border-radius: 10px; margin: 0 auto 28px; max-width: 1500px; padding: 8px 16px 16px; }
  section.card h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 8px 0 4px; }
  .mxgraph { width: 100%; }
  body.only section.card { display: none; }
  body.only section.card.active { display: block; }
</style>
</head>
<body>
<h1>TrackED — diagram set</h1>
<p class="note">Rendered with the draw.io viewer from the .drawio files in this folder. Add <code>?only=3</code> to the URL to show a single diagram.</p>
${cards}
<script>
  const only = new URLSearchParams(location.search).get("only");
  if (only) {
    document.body.classList.add("only");
    const card = document.querySelector('section.card[data-index="' + (Number(only) - 1) + '"]');
    if (card) card.classList.add("active");
  }
</script>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body>
</html>
`;

writeFileSync(join(HERE, "preview.html"), html, "utf8");
console.log(`preview.html written with ${files.length} diagrams`);
