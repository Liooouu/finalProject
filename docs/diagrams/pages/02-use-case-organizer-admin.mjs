import { Page, S, E } from "../lib.mjs";

export default function build() {
  const p = new Page("1.1 Use Case - Organizer and Admin", 1620, 1020);

  p.add(
    "TrackED System",
    "rounded=0;whiteSpace=wrap;html=1;fillColor=none;verticalAlign=top;align=left;spacingLeft=12;spacingTop=8;fontStyle=1;strokeColor=#374151;",
    270,
    40,
    1120,
    880
  );

  const organizer = p.add("Organizer", S.actor, 80, 420, 30, 60);
  const admin = p.add("Admin", S.actor, 1480, 420, 30, 60);

  p.add("Organizer only", S.label, 310, 88, 240, 24);
  p.add("Admin only", S.label, 950, 88, 240, 24);
  p.add("Shared by both roles", S.label, 620, 68, 260, 24);

  const orgOnly = [
    "Create Event",
    "Edit Own Event",
    "Delete Own Event",
    "Change Event Status",
    "Pause / Resume Auto Status",
    "View Own Attendees",
  ].map((t, i) => p.add(t, S.uc, 310, 120 + i * 56, 230, 44));

  const shared = [
    "Log In",
    "View Notifications",
    "Update Profile",
    "Change Password",
    "Review PIN Reset Requests",
    "View Events",
    "Record Attendance",
    "Validate Attendance Window",
    "Scan Student QR",
    "Validate QR Freshness",
    "Add Attendee Manually",
    "Edit Attendee Status",
    "Adjust Community Service Hours",
    "Review Excuse Letters",
    "View Dashboard Statistics",
  ].map((t, i) => p.add(t, S.uc, 620, 100 + i * 50, 250, 40));

  const adminOnly = [
    "Create Organizer Account",
    "Manage Users",
    "Reset Student PIN",
    "Unlock Face Verification",
    "Review Face Appeals",
    "Manage All Events",
    "Generate Attendance Reports",
    "Configure Email Settings",
    "Delete Any Event",
  ].map((t, i) => p.add(t, S.uc, 950, 120 + i * 56, 250, 44));

  orgOnly.concat(shared).forEach((id) => p.edge(E.assoc, organizer, id));
  adminOnly.concat(shared).forEach((id) => p.edge(E.assoc, admin, id));

  p.edge(E.include, shared[6], shared[7], "«include»");
  p.edge(E.include, shared[8], shared[9], "«include»");
  p.edge(E.include, shared[13], shared[12], "«include»");

  p.add(
    "Legend:  solid line = association (actor can initiate the use case)   •   «include» = mandatory sub-behaviour   •   shared ellipses are connected to both actors because both roles can perform them.",
    S.legend,
    270,
    940,
    1140,
    40
  );

  return p;
}
