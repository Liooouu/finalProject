const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let settings;
let reads;
const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === "./appSettings" && parent?.filename.endsWith("emailTemplate.js")) {
    return { getEmailSettings: async () => { reads++; return settings; } };
  }
  return originalLoad.call(this, name, parent, ...rest);
};
const { renderNotificationEmail, renderVerificationEmail, renderPasswordResetEmail } = require("../services/emailTemplate");
Module._load = originalLoad;

beforeEach(() => {
  settings = { smtp: { appUrl: "https://tracked.example.test" }, templates: {} };
  reads = 0;
});

test("event emails include Philippine start/end and overnight attendance-window dates", async () => {
  const message = await renderNotificationEmail({
    title: "Attendance is open", message: "Go to the organizer's face station.",
    event: { title: "CCIT event", date: "2026-11-03", time: "22:00", endDate: "2026-11-04", endTime: "02:00", attendanceStartTime: "23:00", attendanceEndTime: "00:30", location: "Room 101" },
  });
  assert.equal(reads, 1);
  assert.match(message.text, /Starts:.*Nov 3, 2026.*10:00 pm/i);
  assert.match(message.text, /Ends:.*Nov 4, 2026.*2:00 am/i);
  assert.match(message.text, /Time In: Nov 3 11:00 PM – Nov 4 12:30 AM/);
  assert.match(message.text, /Philippine time \(UTC\+8\)/);
  assert.match(message.text, /Venue: Room 101/);
  assert.match(message.html, /Time In/);
  assert.match(message.html, /Nov 4, 2026/);
});

test('session emails show each actual Time In cutoff and Time Out dates in HTML and text', async () => {
  const event = { title: 'CCIT', date: '2026-11-08', time: '08:00', endDate: '2026-11-08', endTime: '22:00', attendanceStartTime: '08:00', attendanceEndTime: '08:30', attendanceSessions: [
    { name: 'Morning', timeInOpen: '2026-11-08T00:00:00Z', timeInCutoff: '2026-11-08T01:00:00Z', timeOutOpen: '2026-11-08T03:00:00Z', timeOutClose: '2026-11-08T04:00:00Z' },
    { name: 'Evening', timeInOpen: '2026-11-08T12:00:00Z', timeInCutoff: '2026-11-08T13:00:00Z', timeOutOpen: '2026-11-08T15:00:00Z', timeOutClose: '2026-11-08T17:00:00Z' },
  ] };
  const email = await renderNotificationEmail({ title: 'Event updated', message: 'Check the schedule.', event });
  assert.match(email.text, /Morning · Time In: 8:00 AM – 9:00 AM/);
  assert.match(email.text, /Morning · Time Out: 11:00 AM – 12:00 PM/);
  assert.match(email.text, /Evening · Time Out: Nov 8 11:00 PM – Nov 9 1:00 AM/);
  assert.match(email.html, /Morning · Time Out/); assert.doesNotMatch(email.text, /Attendance window/);
});

test('an additional attendance day stays explicit without repeating full timestamps', async () => {
  const email = await renderNotificationEmail({ title: 'Schedule', message: 'Updated.', event: {
    date: '2026-11-08', time: '08:00', endDate: '2026-11-10', endTime: '17:00',
    attendanceSessions: [{ name: 'Day 2', timeInOpen: '2026-11-09T00:00:00Z', timeInCutoff: '2026-11-09T01:00:00Z', timeOutOpen: '2026-11-09T08:00:00Z', timeOutClose: '2026-11-09T09:00:00Z' }],
  } });
  assert.match(email.text, /Time In: Nov 9 8:00 AM – 9:00 AM/);
  assert.match(email.text, /Time Out: Nov 9 4:00 PM – 5:00 PM/);
});

test("notification placeholders receive the real safe application URL and HTML is escaped", async () => {
  settings.templates.notification = { body: "{message}\nView: {url}", subject: "TrackED\r\n{title}" };
  const email = await renderNotificationEmail({ title: "<Update>", message: '<img src=x onerror="bad()">', event: { title: "A & B", date: "2026-11-03" } });
  assert.equal(email.subject, "TrackED <Update>");
  assert.match(email.text, /View: https:\/\/tracked\.example\.test\//);
  assert.match(email.html, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.match(email.html, /A &amp; B/);
});

test("unsafe or credential-bearing APP_URL cannot become an email link", async () => {
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "https://user:secret@example.test", "not a URL"]) {
    settings.smtp.appUrl = value;
    const email = await renderVerificationEmail({ name: "Student", code: "582041" });
    assert.doesNotMatch(email.html, /href=/);
    assert.doesNotMatch(email.text, /Open TrackED:/);
    assert.doesNotMatch(email.html, /user:secret/);
  }
});

test("production emails cannot link to HTTP or loopback applications", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    settings.templates.notification = { body: "{message}\n{url}" };
    for (const value of ["http://tracked.example.test", "https://localhost:5173", "https://127.0.0.1", "https://[::1]", "https://app.localhost", "https://0.0.0.0"]) {
      settings.smtp.appUrl = value;
      const email = await renderNotificationEmail({ title: "Event notice", message: "A new event is available." });
      assert.doesNotMatch(email.html, /href=/);
      assert.doesNotMatch(email.text, /https?:\/\//);
    }
    settings.smtp.appUrl = "https://tracked.example.test";
    const valid = await renderNotificationEmail({ title: "Event notice", message: "A new event is available." });
    assert.match(valid.html, /href="https:\/\/tracked\.example\.test\/"/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("verification and reset emails preserve one readable code and matching security instructions", async () => {
  for (const render of [renderVerificationEmail, renderPasswordResetEmail]) {
    const email = await render({ name: 'Lio <script>', code: "582041" });
    assert.equal((email.html.match(/582041/g) || []).length, 1);
    assert.equal((email.text.match(/582041/g) || []).length, 1);
    for (const copy of [email.html, email.text]) {
      assert.match(copy, /expires in 10 minutes/);
      assert.match(copy, /Do not share this code/);
      assert.match(copy, /most recent code/);
    }
    assert.match(email.html, /Lio &lt;script&gt;/);
    assert.doesNotMatch(email.html, /Lio <script>/);
  }
  const reset = await renderPasswordResetEmail({ name: "Student", code: "582041" });
  assert.match(reset.text, /Your password will stay unchanged/);
});

test("saved code templates do not duplicate an inline code in a separate code box", async () => {
  settings.templates.verification = { body: "Hi {name}, your code is {code}." };
  const email = await renderVerificationEmail({ name: "Student", code: "582041" });
  assert.equal((email.html.match(/582041/g) || []).length, 1);
  assert.equal((email.text.match(/582041/g) || []).length, 1);
  assert.match(email.text, /your code is 582041/);
  settings.templates.verification = { title: "Verification code: {code}" };
  const titled = await renderVerificationEmail({ name: "Student", code: "582041" });
  assert.equal((titled.html.match(/582041/g) || []).length, 1);
  assert.equal((titled.text.match(/582041/g) || []).length, 1);
});

test("calendar date formatting does not depend on the server timezone", async () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const email = await renderNotificationEmail({ title: "Event notice", message: "A new event is available.", event: { date: "2026-11-03", time: "08:00" } });
    assert.match(email.text, /Nov 3, 2026.*8:00 am/i);
    assert.doesNotMatch(email.text, /Nov 2, 2026/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
