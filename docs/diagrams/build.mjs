// Builds the TrackED diagram set as draw.io files.
// Usage: node docs/diagrams/build.mjs
// Outputs ten individual .drawio files plus one multi-page file.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import useCaseStudent from "./pages/01-use-case-student.mjs";
import useCaseStaff from "./pages/02-use-case-organizer-admin.mjs";
import context from "./pages/03-context-flow.mjs";
import dfd0 from "./pages/04-dfd-level-0.mjs";
import dfd1 from "./pages/05-dfd-level-1-record-attendance.mjs";
import activityQr from "./pages/06-activity-qr-attendance.mjs";
import activityExcuse from "./pages/07-activity-excuse-letter.mjs";
import erd from "./pages/08-erd.mjs";
import seqQr from "./pages/09-sequence-qr-attendance.mjs";
import seqExcuse from "./pages/10-sequence-excuse-review.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const definitions = [
  ["01-use-case-student", useCaseStudent],
  ["02-use-case-organizer-admin", useCaseStaff],
  ["03-context-flow", context],
  ["04-dfd-level-0", dfd0],
  ["05-dfd-level-1-record-attendance", dfd1],
  ["06-activity-qr-attendance", activityQr],
  ["07-activity-excuse-letter", activityExcuse],
  ["08-erd", erd],
  ["09-sequence-qr-attendance", seqQr],
  ["10-sequence-excuse-review", seqExcuse],
];

const header =
  '<mxfile host="app.diagrams.net" agent="TrackED diagram generator" version="24.7.17" type="device">';

const built = definitions.map(([file, build]) => [file, build()]);

for (const [file, page] of built) {
  writeFileSync(
    join(HERE, `${file}.drawio`),
    `${header}\n${page.diagramXml()}\n</mxfile>\n`,
    "utf8"
  );
}

writeFileSync(
  join(HERE, "tracked-all-diagrams.drawio"),
  `${header}\n${built.map(([, page]) => page.diagramXml()).join("\n")}\n</mxfile>\n`,
  "utf8"
);

mkdirSync(HERE, { recursive: true });
console.log(`Wrote ${built.length} diagrams + combined file to ${HERE}`);
for (const [file, page] of built) {
  console.log(`  ${file}.drawio  —  ${page.name}  (${page.cells.length} cells)`);
}
