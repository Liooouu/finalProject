const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let stored, attempts, send, enabled, directory;
const load = Module._load;
Module._load = function (name, parent, ...rest) {
  const mocks = {
    "../models/User": {
      find: filter => ({ select: async () => directory.filter(user => filter.$or.some(clause =>
        clause._id === user._id || clause.role?.$in?.includes(user.role)
      )) }),
    },
    "../models/Notification": { insertMany: async rows => { stored.push(...rows); } },
    "./mailer": {
      isMailEnabled: async () => enabled(),
      sendMail: async message => { attempts.push(message.to); return send(message); },
    },
    "./emailTemplate": { renderNotificationEmail: async () => ({ subject: "Event update", html: "<p>Event update</p>", text: "Event update" }) },
  };
  return mocks[name] || load.call(this, name, parent, ...rest);
};
const { notifyUsers, eventRecipients } = require("../services/notify");
Module._load = load;

const tick = () => new Promise(setImmediate);
const recipients = (count, offset = 0) => Array.from({ length: count }, (_, i) => ({
  _id: `student-${i + offset}`, name: `Student ${i + offset}`, email: `student-${i + offset}@example.test`,
}));
const notice = { type: "info", title: "Event update", message: "An event was updated.", relatedEvent: "event-1" };

beforeEach(() => {
  stored = []; attempts = []; directory = []; enabled = () => true; send = async () => true;
});

test("overlapping department announcements share a three-message concurrency limit", { timeout: 2000 }, async () => {
  let active = 0, peak = 0, completed = 0;
  const releases = [];
  send = async () => {
    active += 1; peak = Math.max(peak, active);
    await new Promise(resolve => releases.push(resolve));
    active -= 1; completed += 1;
    return true;
  };
  const first = notifyUsers(recipients(20), notice);
  const second = notifyUsers(recipients(20, 20), notice);
  await tick();
  assert.equal(stored.length, 40, "all in-app notices are saved before SMTP finishes");
  assert.equal(attempts.length, 3);
  while (completed < 40) {
    releases.splice(0).forEach(resolve => resolve());
    await tick();
  }
  await Promise.all([first, second]);
  assert.equal(peak, 3);
  assert.equal(new Set(attempts).size, 40);
});

test("one failed recipient does not interrupt other recipients or remove in-app notices", async () => {
  send = async ({ to }) => {
    if (to.startsWith("student-1@")) throw Error("SMTP rejected recipient");
    if (to.startsWith("student-2@")) return false;
    return true;
  };
  const messages = [];
  const log = console.error;
  console.error = (...args) => messages.push(args.join(" "));
  try {
    await notifyUsers(recipients(8), notice);
  } finally {
    console.error = log;
  }
  assert.equal(stored.length, 8);
  assert.equal(attempts.length, 8);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /2 of 8 recipients/);
  assert.doesNotMatch(messages[0], /@example/);
});

test("an SMTP initialization failure does not report an already-saved action as failed", async () => {
  enabled = () => { throw Error("SMTP password unavailable"); };
  const messages = [];
  const log = console.error;
  console.error = (...args) => messages.push(args.join(" "));
  try {
    await assert.doesNotReject(notifyUsers(recipients(2), notice));
  } finally {
    console.error = log;
  }
  assert.equal(stored.length, 2);
  assert.equal(attempts.length, 0);
  assert.match(messages.join(" "), /Notification email delivery failed/);
});

test("shared event announcements reach other legacy organizers and promoted students once", async () => {
  directory = [
    { _id: "owner", role: "organizer", name: "Event owner", email: "owner@example.test" },
    { _id: "helper", role: "organizer", name: "Other organizer", email: "helper@example.test" },
    { _id: "promoted", role: "student", organizerAccess: true, name: "Student organizer", email: "promoted@example.test" },
    { _id: "student", role: "student", name: "Student", email: "student@example.test" },
    { _id: "admin", role: "admin", name: "Admin", email: "admin@example.test" },
  ];
  const audience = await eventRecipients({ organizer: { _id: "owner" } });
  assert.deepEqual(new Set(audience.map(user => user._id)), new Set(["owner", "helper", "promoted", "student", "admin"]));
  await notifyUsers(audience, notice);
  assert.equal(stored.length, 5);
  assert.equal(attempts.length, 5);
  assert.equal(attempts.filter(email => email === "owner@example.test").length, 1);
});
