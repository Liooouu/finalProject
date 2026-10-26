import { Page, S, E } from "../lib.mjs";

export default function build() {
  const p = new Page("Context Diagram (Process 0)", 1300, 900);

  const system = p.add("0\nTrackED System", S.proc, 560, 340, 180, 170);

  const student = p.add("Student", S.entity, 80, 370, 160, 70);
  const organizer = p.add("Organizer", S.entity, 560, 90, 160, 60);
  const admin = p.add("Admin", S.entity, 1040, 370, 160, 70);
  const mail = p.add("Email / SMTP Service", S.entity, 540, 700, 200, 60);

  p.edge(
    E.flow,
    student,
    system,
    "Registration & credentials\nPIN, selfie, security requests\nAttendance request (QR session)\nExcuse letter + attachments\nProfile & face photo",
    { exitX: 1, exitY: 0.3, entryX: 0, entryY: 0.35 }
  );
  p.edge(
    E.flow,
    system,
    student,
    "Session token & role\nEvent list & details\nAttendance result\nCommunity service balance\nExcuse decision & notifications",
    { exitX: 0, exitY: 0.65, entryX: 1, entryY: 0.7 }
  );

  p.edge(
    E.flow,
    organizer,
    system,
    "Event details & schedule\nQR payload (student ID + timestamp)\nAttendance corrections\nExcuse decision",
    { exitX: 0.3, exitY: 1, entryX: 0.35, entryY: 0 }
  );
  p.edge(
    E.flow,
    system,
    organizer,
    "Attendee lists\nExcuse queue\nDashboard statistics\nNotifications",
    { exitX: 0.65, exitY: 0, entryX: 0.7, entryY: 1 }
  );

  p.edge(
    E.flow,
    admin,
    system,
    "Organizer account details\nUser edits\nPIN / face decisions\nReport filters & export requests\nSMTP settings",
    { exitX: 0, exitY: 0.3, entryX: 1, entryY: 0.35 }
  );
  p.edge(
    E.flow,
    system,
    admin,
    "User lists\nSecurity appeal queue\nReports & CSV exports\nSettings status\nNotifications",
    { exitX: 1, exitY: 0.65, entryX: 0, entryY: 0.7 }
  );

  p.edge(E.flow, system, mail, "Verification & reset codes\nNotification emails", {
    exitX: 0.5,
    exitY: 1,
    entryX: 0.5,
    entryY: 0,
  });

  p.add(
    "Context diagram rules applied: one process (0), external entities only, no data stores, every arrow labelled with the data that crosses the system boundary. Email is outbound-only.",
    S.legend,
    80,
    800,
    1120,
    60
  );

  return p;
}
