import { Page, S, E } from "../lib.mjs";

const TOP = 120;
const HEIGHT = 1100;
const frac = (y) => ((y - TOP) / HEIGHT).toFixed(4);

export default function build() {
  const p = new Page("1.1 Sequence - Excuse Submission and Review", 1620, 1320);

  p.add(
    "alt  already reviewed → 409 (atomic claim on status = pending; hours are never deducted twice)",
    S.frame,
    60,
    740,
    1460,
    90
  );
  p.add(
    "opt  side effect fails → excuse reverted to pending   ·   reject → no attendance or hour change",
    S.frame,
    60,
    870,
    1460,
    130
  );

  const student = p.add("Student : Browser", S.lifeline, 70, TOP, 150, HEIGHT);
  const api = p.add("API : Express", S.lifeline, 330, TOP, 150, HEIGHT);
  const files = p.add("FileStore : GridFS", S.lifeline, 590, TOP, 150, HEIGHT);
  const db = p.add("Database : MongoDB", S.lifeline, 850, TOP, 150, HEIGHT);
  const staff = p.add("Organizer / Admin : Browser", S.lifeline, 1110, TOP, 160, HEIGHT);
  const notifier = p.add("Notifier : In-app + SMTP", S.lifeline, 1380, TOP, 150, HEIGHT);

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

  // phase 1 — the student files the letter
  msg(student, api, 200, "1. POST /api/student/excuses  (multipart + JWT)");
  self(api, 330, 244, "2. verify role · event exists · no active excuse ·\n   absence needs an absent record, advance needs an upcoming event");
  msg(api, files, 288, "3. save up to 5 images (JPEG/PNG, ≤ 4 MB)");
  ret(files, api, 332, "4. stored URLs");
  msg(api, db, 376, "5. insert Excuse { status: pending }");
  msg(api, db, 420, "6. find reviewers (event organizer + all admins)");
  msg(api, notifier, 464, "7. notify reviewers");
  ret(api, student, 508, "8. 201 excuse");

  p.add("", "rounded=0;html=1;fillColor=none;dashed=1;strokeColor=#6b7280;", 60, 566, 1460, 2);
  p.add("later — separate review session", S.label, 70, 574, 400, 24);

  // phase 2 — staff review
  msg(staff, api, 620, "9. GET /api/organizer/excuses");
  msg(api, db, 664, "10. excuses for events the reviewer owns");
  ret(db, api, 708, "11. review queue");
  ret(api, staff, 752, "12. queue with student + event details");

  msg(staff, api, 800, "13. PATCH /api/organizer/excuses/:id\n    { status, responseNote, removal }");
  msg(api, db, 844, "14. load excuse + event (ownership check)");
  msg(api, db, 888, "15. findOneAndUpdate({ _id, status: 'pending' }) — claim");
  msg(api, db, 932, "16. attendance → excused · adjust hours + log");
  msg(api, db, 976, "17. save removedHours on the excuse");
  msg(api, notifier, 1020, "18. notify student of the decision");
  ret(api, staff, 1064, "19. 200 reviewed excuse");

  p.add(
    "Advance excuses are approved before the event, so the attendance record is created as “excused” and the 60-second absence job never penalises the student. Approving a later check-in restores the hours the excuse removed.",
    S.note,
    180,
    1090,
    1200,
    90
  );

  return p;
}
