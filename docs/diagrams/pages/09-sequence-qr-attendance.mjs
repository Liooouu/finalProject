import { Page, S, E } from "../lib.mjs";

const TOP = 120;
const HEIGHT = 900;
const frac = (y) => ((y - TOP) / HEIGHT).toFixed(4);

export default function build() {
  const p = new Page("1.0 Sequence - QR Code Attendance", 1500, 1120);

  // frame first so it renders behind the lifelines and messages
  p.add(
    "alt  rejection paths: not open yet · QR expired · already marked · window closed · not authorised",
    S.frame,
    60,
    430,
    1380,
    480
  );

  const student = p.add("Student : Browser", S.lifeline, 90, TOP, 150, HEIGHT);
  const organizer = p.add("Organizer : Browser", S.lifeline, 320, TOP, 150, HEIGHT);
  const api = p.add("API : Express", S.lifeline, 620, TOP, 150, HEIGHT);
  const db = p.add("Database : MongoDB", S.lifeline, 920, TOP, 150, HEIGHT);
  const notifier = p.add("Notifier : In-app + SMTP", S.lifeline, 1220, TOP, 150, HEIGHT);

  const msg = (src, tgt, y, label) =>
    p.edge(E.msg, src, tgt, label, {
      exitX: 0.5,
      exitY: frac(y),
      entryX: 0.5,
      entryY: frac(y),
    });

  const ret = (src, tgt, y, label) =>
    p.edge(E.ret, src, tgt, label, {
      exitX: 0.5,
      exitY: frac(y),
      entryX: 0.5,
      entryY: frac(y),
    });

  const self = (lifeline, x, y, label) =>
    p.edge(E.msg + "edgeStyle=orthogonalEdgeStyle;", lifeline, lifeline, label, {
      exitX: 0.5,
      exitY: frac(y),
      entryX: 0.5,
      entryY: frac(y + 22),
      points: [
        [x + 115, y],
        [x + 115, y + 22],
      ],
    });

  msg(student, api, 210, "1. GET /api/events/:id  (JWT)");
  msg(api, db, 256, "2. find event");
  ret(db, api, 302, "3. event document");
  ret(api, student, 348, "4. event + attendance window");

  self(student, 90, 394, "5. render QR {eventId, studentId, issuedAt};\n   refresh every 30 s (no server call)");

  msg(organizer, api, 440, "6. POST /api/events/:id/attendance/scan\n   {studentId, timestamp}");
  msg(api, db, 486, "7. find event + find student");

  self(api, 620, 532, "8. authorise owner/admin-created · not terminal ·\n   window open · QR age ≤ 10 min");

  msg(api, db, 578, "9. find attendance (duplicate check)");

  self(api, 620, 624, "10. decide present / late (+4 CS hours)");

  msg(api, db, 670, "11. insert / update attendance + CS log");
  msg(api, db, 716, "12. insert notification");
  msg(api, notifier, 762, "13. queue email (async)");
  ret(api, organizer, 808, "14. 201 { attendance, message }");

  self(organizer, 320, 854, "15. pause 1.8 s · show feedback · resume camera");

  p.add(
    "Design note: the server clock, not the client timestamp, decides present vs late. The QR timestamp is only a freshness check — a screenshot older than 10 minutes is rejected.",
    S.note,
    250,
    1000,
    1000,
    80
  );

  return p;
}
