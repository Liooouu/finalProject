import { Page, S, E } from "../lib.mjs";

export default function build() {
  const p = new Page("DFD Level 0", 1720, 1180);

  const student = p.add("Student", S.entity, 40, 180, 150, 60);
  const organizer = p.add("Organizer", S.entity, 40, 470, 150, 60);
  const admin = p.add("Admin", S.entity, 40, 780, 150, 60);
  const mail = p.add("Email / SMTP Service", S.entity, 1160, 1040, 190, 60);

  const proc = (t, x, y) => p.add(t, S.proc, x, y, 190, 120);

  const p1 = proc("1.0\nManage Accounts\n& Access", 330, 120);
  const p2 = proc("2.0\nManage\nEvents", 600, 120);
  const p3 = proc("3.0\nRecord\nAttendance", 330, 380);
  const p4 = proc("4.0\nManage Excuse\nLetters", 600, 380);
  const p5 = proc("5.0\nCompute & Adjust\nCS Hours", 330, 640);
  const p6 = proc("6.0\nNotify\nUsers", 600, 640);
  const p7 = proc("7.0\nGenerate\nReports", 330, 880);
  const p8 = proc("8.0\nAdminister\nSettings", 600, 880);

  const store = (t, y) => p.add(t, S.store, 1080, y, 300, 55);

  const d1 = store("D1  Users", 120);
  const d2 = store("D2  Events", 200);
  const d3 = store("D3  Attendance", 280);
  const d4 = store("D4  Excuse Letters", 360);
  const d5 = store("D5  Notifications", 440);
  const d6 = store("D6  Settings", 520);
  const d7 = store("D7  Files (GridFS)", 600);
  const d8 = store("D8  Security Requests", 680);

  // External entity -> process
  p.edge(E.flow, student, p1, "registration, credentials, PIN, selfie");
  p.edge(E.flow, p1, student, "token, role, PIN");
  p.edge(E.flow, student, p3, "check-in / QR session request");
  p.edge(E.flow, p3, student, "attendance result");
  p.edge(E.flow, student, p4, "excuse letter + attachments");
  p.edge(E.flow, p4, student, "excuse decision");

  p.edge(E.flow, organizer, p2, "event details, schedule");
  p.edge(E.flow, p2, organizer, "event record / list");
  p.edge(E.flow, organizer, p3, "QR payload, manual entry");
  p.edge(E.flow, p3, organizer, "scan result, attendee list");
  p.edge(E.flow, organizer, p4, "review decision");
  p.edge(E.flow, p4, organizer, "excuse queue");
  p.edge(E.flow, organizer, p5, "hour correction");

  p.edge(E.flow, admin, p1, "PIN / face decisions");
  p.edge(E.flow, p1, admin, "security queue");
  p.edge(E.flow, admin, p2, "manage any event");
  p.edge(E.flow, admin, p7, "report filters, export request");
  p.edge(E.flow, p7, admin, "report data, CSV");
  p.edge(E.flow, admin, p8, "organizer account, SMTP settings");
  p.edge(E.flow, p8, admin, "settings status");

  // Process <-> store
  p.edge(E.flow, p1, d1, "account record (read / write)");
  p.edge(E.flow, p1, d8, "security request (read / write)");
  p.edge(E.flow, p1, d7, "face photo");
  p.edge(E.flow, p2, d2, "event record (read / write)");

  p.edge(E.flow, d1, p3, "student record");
  p.edge(E.flow, d2, p3, "event schedule & status");
  p.edge(E.flow, p3, d3, "attendance record");
  p.edge(E.flow, d3, p3, "duplicate check");

  p.edge(E.flow, p4, d4, "excuse record (read / write)");
  p.edge(E.flow, p4, d7, "attachments");
  p.edge(E.flow, p4, d3, "attendance status update");

  p.edge(E.flow, d3, p5, "attendance hours");
  p.edge(E.flow, p5, d3, "hour adjustments");

  p.edge(E.flow, d1, p6, "recipient details");
  p.edge(E.flow, p6, d5, "notification record");
  p.edge(E.flow, p6, mail, "email message");
  p.edge(E.flow, p3, p6, "attendance result");
  p.edge(E.flow, p4, p6, "decision notice");
  p.edge(E.flow, p1, p6, "verification / reset code");

  p.edge(E.flow, d1, p7, "student demographics");
  p.edge(E.flow, d2, p7, "event data");
  p.edge(E.flow, d3, p7, "attendance data");

  p.edge(E.flow, p8, d6, "settings (read / write)");
  p.edge(E.flow, p8, d1, "organizer account");

  p.add(
    "DFD Level 0 rules: no entity-to-entity flows, no store-to-store flows, every process has at least one input and one output, and every flow here is a refinement of a flow on the context diagram.",
    S.legend,
    40,
    1100,
    1000,
    50
  );

  return p;
}
