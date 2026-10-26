import { Page, S, E } from "../lib.mjs";

export default function build() {
  const p = new Page("1.0 Use Case - Student", 1560, 1040);

  p.add(
    "TrackED System",
    "rounded=0;whiteSpace=wrap;html=1;fillColor=none;verticalAlign=top;align=left;spacingLeft=12;spacingTop=8;fontStyle=1;strokeColor=#374151;",
    170,
    40,
    1180,
    880
  );

  const student = p.add("Student", S.actor, 70, 430, 30, 60);
  const email = p.add("Email\nService", S.actor, 1470, 190, 30, 60);

  const label = (t, x, y) => p.add(t, S.label, x, y, 320, 24);
  label("Account & Access", 200, 72);
  label("Events & Attendance", 200, 342);
  label("Excuse Letters", 700, 72);
  label("Hours, Notifications & Profile", 200, 532);

  const uc = (t, x, y) => p.add(t, S.uc, x, y, 220, 42);

  // Account & access
  const u1 = uc("Register Account", 200, 100);
  const u2 = uc("Verify Email Code", 450, 100);
  const u3 = uc("Log In", 200, 158);
  const u4 = uc("Verify New Device with PIN", 450, 158);
  const u5 = uc("Reset Forgotten Password", 200, 216);
  const u6 = uc("Recover PIN via Face Scan", 450, 216);
  const u7 = uc("Submit Face Verification Appeal", 200, 274);
  const u8 = uc("Request PIN Reset", 450, 274);

  // Events & attendance
  const u9 = uc("View Events", 200, 370);
  const u10 = uc("View Event Details", 450, 370);
  const u11 = uc("Show Attendance QR", 200, 428);
  const u12 = uc("Mark Attendance (self check-in)", 450, 428);
  const u13 = uc("Validate Attendance Window", 700, 428);
  const u14 = uc("Validate Event Session", 700, 370);

  // Excuse letters
  const u15 = uc("Submit Excuse Letter", 700, 100);
  const u16 = uc("Check Excuse Eligibility", 700, 158);
  const u17 = uc("Attach Supporting Documents", 960, 100);
  const u18 = uc("View My Excuse Letters", 700, 216);
  const u19 = uc("View Absent Events", 700, 274);

  // Hours, notifications, profile
  const u20 = uc("View Community Service Hours", 200, 560);
  const u21 = uc("View Notifications", 450, 560);
  const u22 = uc("Mark Notification as Read", 700, 560);
  const u23 = uc("Update Profile", 200, 618);
  const u24 = uc("Change Password", 450, 618);
  const u25 = uc("Enroll Face Photo", 700, 618);
  const u26 = uc("View / Rotate PIN", 960, 560);
  const u27 = uc("Manage Trusted Devices", 960, 618);
  const u28 = uc("View Attendance History", 960, 676);

  const initiated = [
    u1, u2, u3, u4, u5, u6, u7, u8,
    u9, u10, u11, u12,
    u15, u17, u18, u19,
    u20, u21, u22, u23, u24, u25, u26, u27, u28,
  ];
  initiated.forEach((id) => p.edge(E.assoc, student, id));

  [u2, u5, u8].forEach((id) => p.edge(E.assoc, email, id));

  p.edge(E.include, u12, u13, "«include»");
  p.edge(E.include, u11, u14, "«include»");
  p.edge(E.include, u15, u16, "«include»");
  p.edge(E.include, u17, u15, "«extend»");
  p.edge(E.include, u4, u3, "«extend»");
  p.edge(E.include, u7, u6, "«extend»");

  p.add(
    "Legend:  solid line = association (no arrowhead)   •   «include» = mandatory sub-behaviour   •   «extend» = optional / conditional behaviour   •   Email Service is a secondary actor (external system).",
    S.legend,
    170,
    940,
    1220,
    40
  );

  return p;
}
