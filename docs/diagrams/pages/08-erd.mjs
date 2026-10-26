import { Page, S, E } from "../lib.mjs";

export default function build() {
  const p = new Page("ERD - TrackED", 1720, 1060);

  const box =
    "rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=8;fontSize=11;fillColor=#ffffff;";

  const user = p.add(
    "USER\nPK  user_id\nname\nemail  (unique)\npassword_hash\nrole  (student / organizer / admin)\nprofile_picture\nprogram · year_level · section\npin_hash · pin_attempts · pin_lock_until\nface_photo · face_descriptor\nface_attempts · face_lock_until\nemail_verified\ncreated_at · updated_at",
    box,
    120,
    420,
    280,
    270
  );

  const device = p.add(
    "TRUSTED_DEVICE  (weak)\nPK  device_id\nFK  user_id\nlabel\nverified_at · last_used_at",
    box,
    120,
    120,
    250,
    160
  );

  const event = p.add(
    "EVENT\nPK  event_id\nFK  organizer_id → USER\ntitle · description\ndate · time · end_date · end_time\nlocation · map_query\nstatus  (upcoming / live / finished / closed)\nattendance_start_time · attendance_end_time\nmanual_override · auto_finished_at\nnotification flags\ncreated_at · updated_at",
    box,
    640,
    390,
    290,
    280
  );

  const attendance = p.add(
    "ATTENDANCE\nPK  attendance_id\nFK  event_id → EVENT\nFK  student_id → USER\nattended_at\nstatus  (present / late / absent /\npending / excused)\ncommunity_service_hours\nevent_title · event_date\nUNIQUE (event_id, student_id)",
    box,
    1090,
    390,
    280,
    250
  );

  const cslog = p.add(
    "CS_LOG  (weak)\nPK  log_id\nFK  attendance_id\naction  (penalty /\nremoved / restored)\nhours · note · at",
    box,
    1430,
    430,
    225,
    190
  );

  const excuse = p.add(
    "EXCUSE\nPK  excuse_id\nFK  student_id → USER\nFK  event_id → EVENT\nFK  reviewed_by → USER\nexcuse_text\ntype  (absence / advance)\nstatus  (pending / approved / rejected)\nresponse_note\nremoved_hours\nattachment_url\ncreated_at",
    box,
    640,
    60,
    290,
    260
  );

  const notification = p.add(
    "NOTIFICATION\nPK  notification_id\nFK  user_id → USER\nFK  related_event_id → EVENT\ntype · title · message\nis_read\ncreated_at",
    box,
    1090,
    60,
    270,
    200
  );

  const appeal = p.add(
    "FACE_APPEAL\nPK  appeal_id\nFK  student_id → USER\nFK  reviewed_by → USER\nnote · photo_url\nstatus · response_note\ncreated_at",
    box,
    120,
    760,
    260,
    180
  );

  const pinReq = p.add(
    "PIN_RESET_REQUEST\nPK  request_id\nFK  student_id → USER\nFK  reviewed_by → USER\nnote · status · response_note\ndevice_id · device_label\ncreated_at",
    box,
    420,
    760,
    280,
    190
  );

  const setting = p.add(
    "SETTING\nPK  key\nsmtp_host · smtp_port · smtp_secure\nsmtp_user · smtp_from · app_url\ntemplates  (verification / reset /\nnotification)\nFK  updated_by → USER\nupdated_at",
    box,
    1180,
    760,
    320,
    190
  );

  const file = p.add(
    "FILE  (optional)\nPK  file_id\nurl · original_name\ncontent_type · size",
    box,
    390,
    60,
    200,
    130
  );

  p.edge(E.er, user, device, "registers");
  p.edge(E.er, user, event, "creates");
  p.edge(E.er, user, attendance, "has");
  p.edge(E.er, event, attendance, "records");
  p.edge(E.er, attendance, cslog, "logs");
  p.edge(E.er, user, excuse, "files", { exitX: 1, exitY: 0.2, entryX: 0, entryY: 0.85 });
  p.edge(E.er, user, excuse, "reviews", { exitX: 0.8, exitY: 0, entryX: 0.1, entryY: 1 });
  p.edge(E.er, user, notification, "receives");
  p.edge(E.er, event, notification, "relates to");
  p.edge(E.er, user, appeal, "submits");
  p.edge(E.er, user, pinReq, "requests");
  p.edge(E.er, user, setting, "updates");
  p.edge(E.er, excuse, file, "attaches");

  p.add(
    "Crow's foot notation.  ATTENDANCE is the associative entity that resolves the student–event many-to-many relationship.  TRUSTED_DEVICE and CS_LOG are weak entities (MongoDB embedded arrays) — double-border them in the final rendering.  FILE is optional: attachments live in GridFS and are referenced by URL.",
    S.legend,
    120,
    980,
    1300,
    60
  );

  return p;
}
