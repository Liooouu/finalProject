import { Page, S, E, startNode, endNode } from "../lib.mjs";

export default function build() {
  const p = new Page("1.1 Activity - Excuse Letter", 1520, 1300);

  const lane = (title, x, w) => {
    p.add("", S.laneBody, x, 60, w, 1180);
    p.add(title, S.laneHead, x, 60, w, 34);
  };
  lane("Student", 40, 380);
  lane("TrackED System", 440, 520);
  lane("Organizer / Admin", 980, 500);

  const start = startNode(p, 215, 92);
  const s1 = p.add("Open event / Absent Events", S.act, 70, 130, 320, 44);
  const s2 = p.add("Choose excuse type\n(absence / advance)", S.act, 70, 200, 320, 54);
  const s3 = p.add("Write excuse letter", S.act, 70, 470, 320, 44);
  const s4 = p.add("Attach proof\n(optional, up to 5 images)", S.act, 70, 540, 320, 54);
  const s5 = p.add("Submit excuse letter", S.act, 70, 620, 320, 44);
  const s6 = p.add("View decision + note", S.act, 70, 940, 320, 44);
  const finish = endNode(p, 215, 1140);

  const y1 = p.add("One active excuse\nfor this event?", S.dec, 490, 190, 420, 70);
  const y2 = p.add("Excuse type?", S.dec, 490, 290, 420, 66);
  const y3 = p.add("Absent record\nexists?", S.dec, 490, 390, 200, 76);
  const y4 = p.add("Upcoming event and\nno attendance yet?", S.dec, 710, 390, 200, 76);
  const y5 = p.add("Store files in GridFS", S.act, 490, 520, 420, 44);
  const y6 = p.add("Create Excuse (pending)", S.act, 490, 590, 420, 44);
  const y7 = p.add("Notify organizer + admins", S.act, 490, 660, 420, 44);
  const y8 = p.add("Record rejection,\nnotify student", S.act, 490, 860, 420, 54);
  const y9 = p.add("Set attendance = excused", S.act, 490, 940, 420, 44);
  const y10 = p.add("Adjust CS hours + log", S.act, 490, 1010, 420, 44);
  const y11 = p.add("Save removedHours", S.act, 490, 1080, 420, 44);
  const y12 = p.add("Notify student of decision", S.act, 490, 1150, 420, 44);

  const z1 = p.add("Open Excuse queue", S.act, 1010, 700, 440, 44);
  const z2 = p.add("Read letter + attachments", S.act, 1010, 770, 440, 44);
  const z3 = p.add("Approve or reject?", S.dec, 1010, 840, 440, 66);
  const z4 = p.add("Student already\npresent / late?", S.dec, 1010, 930, 440, 66);
  const z5 = p.add("Removal mode?", S.dec, 1010, 1020, 440, 66);
  const z6 = p.add("Forgive all hours\nfor this event", S.act, 1010, 1110, 200, 60);
  const z7 = p.add("Remove flat\n16 hours", S.act, 1250, 1110, 200, 60);

  p.edge(E.flow, start, s1);
  p.edge(E.flow, s1, s2);
  p.edge(E.flow, s2, y1);
  p.edge(E.flow, y1, s1, "Yes: already pending / approved");
  p.edge(E.flow, y1, y2, "No");
  p.edge(E.flow, y2, y3, "[absence]");
  p.edge(E.flow, y2, y4, "[advance]");
  p.edge(E.flow, y3, s1, "No: no absent record");
  p.edge(E.flow, y3, y5, "Yes");
  p.edge(E.flow, y4, s1, "No: not upcoming / already attended");
  p.edge(E.flow, y4, s3, "Yes");
  p.edge(E.flow, y4, y5, "eligible");
  p.edge(E.flow, s3, s4);
  p.edge(E.flow, s4, s5);
  p.edge(E.flow, s5, y5);
  p.edge(E.flow, y5, y6);
  p.edge(E.flow, y6, y7);
  p.edge(E.flow, y7, z1);
  p.edge(E.flow, z1, z2);
  p.edge(E.flow, z2, z3);
  p.edge(E.flow, z3, y8, "Reject");
  p.edge(E.flow, z3, z4, "Approve");
  p.edge(E.flow, z4, z2, "Yes: cannot approve");
  p.edge(E.flow, z4, z5, "No");
  p.edge(E.flow, z5, z6, "[forgive all]");
  p.edge(E.flow, z5, z7, "[remove 16 hrs]");
  p.edge(E.flow, z6, y9);
  p.edge(E.flow, z7, y9);
  p.edge(E.flow, y9, y10);
  p.edge(E.flow, y10, y11);
  p.edge(E.flow, y11, y12);
  p.edge(E.flow, y8, s6);
  p.edge(E.flow, y12, s6);
  p.edge(E.flow, s6, finish);

  p.add(
    "Guards in [brackets] select the branch. Approving an advance excuse creates the “excused” attendance record before the event, which is what stops the automatic 8-hour absence penalty.",
    S.legend,
    40,
    1250,
    950,
    40
  );

  return p;
}
