import { Page, S, E } from "../lib.mjs";

export default function build() {
  const p = new Page("DFD Level 1 - Record Attendance", 1500, 1000);

  p.add(
    "3.0  Record Attendance  (decomposition)",
    "rounded=0;whiteSpace=wrap;html=1;fillColor=none;verticalAlign=top;align=left;spacingLeft=12;spacingTop=8;fontStyle=1;strokeColor=#374151;dashed=0;",
    250,
    60,
    900,
    860
  );

  const student = p.add("Student", S.entity, 50, 180, 140, 60);
  const organizer = p.add("Organizer", S.entity, 50, 430, 140, 60);
  const clock = p.add("System Clock", S.entity, 50, 720, 150, 60);

  const proc = (t, x, y) => p.add(t, S.proc, x, y, 175, 100);

  const s1 = proc("3.1\nAuthenticate &\nAuthorise", 300, 140);
  const s2 = proc("3.2\nValidate Event &\nAttendance Window", 300, 320);
  const s3 = proc("3.3\nValidate\nQR Payload", 300, 500);
  const s4 = proc("3.4\nDetermine Status\n& Hours", 560, 320);
  const s5 = proc("3.5\nSave Attendance\nRecord", 560, 500);
  const s7 = proc("3.7\nRequest\nNotification", 560, 680);
  const s6 = proc("3.6\nReconcile\nAbsences", 830, 140);

  const d1 = p.add("D1  Users", S.store, 1210, 140, 230, 55);
  const d2 = p.add("D2  Events", S.store, 1210, 270, 230, 55);
  const d3 = p.add("D3  Attendance", S.store, 1210, 430, 230, 55);
  const d5 = p.add("D5  Notifications", S.store, 1210, 590, 230, 55);
  const p6 = p.add("6.0\nNotify Users", S.proc, 1210, 720, 180, 110);

  p.edge(E.flow, student, s1, "check-in request");
  p.edge(E.flow, organizer, s1, "QR payload (studentId, timestamp)");

  p.edge(E.flow, s1, d1, "verify identity & role");
  p.edge(E.flow, s1, s2, "authenticated request");

  p.edge(E.flow, d2, s2, "event status & window");
  p.edge(E.flow, s2, student, "window error");
  p.edge(E.flow, s2, s3, "window valid");

  p.edge(E.flow, s3, d3, "duplicate check (read / write)");
  p.edge(E.flow, s3, organizer, "expired / already marked");
  p.edge(E.flow, s3, s4, "accepted payload");

  p.edge(E.flow, s4, s5, "status + hours");
  p.edge(E.flow, s5, d3, "attendance record");
  p.edge(E.flow, s5, s7, "attendance result");
  p.edge(E.flow, s7, p6, "notification request");
  p.edge(E.flow, p6, d5, "notification record");

  p.edge(E.flow, clock, s6, "60-second tick");
  p.edge(E.flow, d2, s6, "finished events");
  p.edge(E.flow, d1, s6, "student list");
  p.edge(E.flow, s6, d3, "absent records (+8 hrs)");

  p.add(
    "Balancing: the inputs from Student and Organizer, and the outputs to D3 and to process 6.0, are the same boundary flows process 3.0 had on the Level 0 diagram — only split across 3.1–3.7.",
    S.legend,
    250,
    930,
    900,
    50
  );

  return p;
}
