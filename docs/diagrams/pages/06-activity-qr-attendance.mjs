import { Page, S, E, startNode, endNode } from "../lib.mjs";

export default function build() {
  const p = new Page("1.0 Activity - QR Code Attendance", 1420, 1360);

  const lane = (title, x, w) => {
    p.add("", S.laneBody, x, 60, w, 1240);
    p.add(title, S.laneHead, x, 60, w, 34);
  };
  lane("Student", 40, 380);
  lane("Organizer", 440, 380);
  lane("TrackED System", 840, 540);

  const start = startNode(p, 215, 92);
  const s1 = p.add("Open Event Details", S.act, 70, 140, 320, 44);
  const s2 = p.add("Event live and\nattendance window open?", S.dec, 70, 210, 320, 72);
  const s3 = p.add("Show “attendance is not open yet”", S.act, 70, 310, 320, 50);
  const s4 = p.add("Display rotating QR\n{eventId, studentId, issuedAt}", S.act, 70, 390, 320, 54);
  const s5 = p.add("Auto-refresh QR every 30 s", S.act, 70, 470, 320, 44);

  const o1 = p.add("Open event → Manage Attendees", S.act, 470, 140, 320, 44);
  const o2 = p.add("Start QR scanner", S.act, 470, 210, 320, 44);
  const o3 = p.add("Aim camera at student’s QR", S.act, 470, 280, 320, 44);
  const oErr = p.add("Show error message\n(scanner stays active)", S.act, 470, 760, 320, 60);
  const o4 = p.add("Show success feedback\n(name, present / late)", S.act, 470, 860, 320, 60);
  const o5 = p.add("Pause 1.8 s, resume scanner", S.act, 470, 950, 320, 44);
  const o6 = p.add("Stop scanning?", S.dec, 470, 1020, 320, 66);
  const stop = endNode(p, 620, 1120);

  const y1 = p.add("Parse JSON payload", S.act, 880, 280, 460, 44);
  const y2 = p.add("eventId matches\nthe open event?", S.dec, 880, 350, 460, 70);
  const y3 = p.add("QR timestamp\n≤ 10 minutes old?", S.dec, 880, 450, 460, 70);
  const y4 = p.add("POST /api/events/:id/attendance/scan", S.act, 880, 550, 460, 44);
  const y5 = p.add("Authorised and\nevent not terminal?", S.dec, 880, 620, 460, 70);
  const y6 = p.add("Inside attendance\nwindow?", S.dec, 880, 720, 460, 70);
  const y7 = p.add("Already recorded\n(and not excused)?", S.dec, 880, 820, 460, 70);
  const y8 = p.add("After\nattendanceEndTime?", S.dec, 880, 920, 460, 70);
  const y9 = p.add("Status = late\n+4 CS hours", S.act, 880, 1020, 210, 50);
  const y10 = p.add("Status = present\n0 hours", S.act, 1130, 1020, 210, 50);
  const y11 = p.add("Save attendance + CS log", S.act, 880, 1100, 460, 44);
  const y12 = p.add("Create notification (+ email)", S.act, 880, 1170, 460, 44);
  const y13 = p.add("Return 201 with message", S.act, 880, 1240, 460, 40);

  p.edge(E.flow, start, s1);
  p.edge(E.flow, s1, s2);
  p.edge(E.flow, s2, s3, "No");
  p.edge(E.flow, s3, s1, "retry");
  p.edge(E.flow, s2, s4, "Yes");
  p.edge(E.flow, s4, s5);
  p.edge(E.include, s5, o3, "student shows the QR");

  p.edge(E.flow, o1, o2);
  p.edge(E.flow, o2, o3);
  p.edge(E.flow, o3, y1);

  p.edge(E.flow, y1, y2);
  p.edge(E.flow, y2, oErr, "No");
  p.edge(E.flow, y2, y3, "Yes");
  p.edge(E.flow, y3, oErr, "No");
  p.edge(E.flow, y3, y4, "Yes");
  p.edge(E.flow, y4, y5);
  p.edge(E.flow, y5, oErr, "No");
  p.edge(E.flow, y5, y6, "Yes");
  p.edge(E.flow, y6, oErr, "No");
  p.edge(E.flow, y6, y7, "Yes");
  p.edge(E.flow, y7, oErr, "Yes");
  p.edge(E.flow, y7, y8, "No");
  p.edge(E.flow, y8, y9, "Yes");
  p.edge(E.flow, y8, y10, "No");
  p.edge(E.flow, y9, y11);
  p.edge(E.flow, y10, y11);
  p.edge(E.flow, y11, y12);
  p.edge(E.flow, y12, y13);
  p.edge(E.flow, y13, o4);
  p.edge(E.flow, oErr, o5);
  p.edge(E.flow, o4, o5);
  p.edge(E.flow, o5, o6);
  p.edge(E.flow, o6, o2, "No");
  p.edge(E.flow, o6, stop, "Yes");

  p.add(
    "Plain flow = control flow.  “No / Yes” labels are the guards on each decision.  Self check-in (Mark Attendance) follows the same validation path without the Organizer lane.",
    S.legend,
    40,
    1310,
    900,
    44
  );

  return p;
}
