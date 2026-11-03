const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "email-route-retirement-test-only";
const accounts = new Map([
  ["111111111111111111111111", { _id: "111111111111111111111111", role: "admin" }],
  ["222222222222222222222222", { _id: "222222222222222222222222", role: "student" }],
  ["333333333333333333333333", { _id: "333333333333333333333333", role: "organizer" }],
  ["444444444444444444444444", { _id: "444444444444444444444444", role: "student", organizerAccess: true }],
]);
let effects;
const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  const mocks = {
    "../models/User": { findById: id => ({ select: async () => accounts.get(String(id)) }) },
    "../models/Attendance": {}, "../models/Excuse": {}, "../models/Notification": {},
    "../models/FaceAppeal": {}, "../models/CheckInSession": {}, "../models/Event": {},
    "../models/ManualAttendanceRequest": {},
    "../services/notify": {}, "../services/fileStore": {}, "../services/faceIdentify": {},
    "../services/mailer": { isMailEnabled: async () => true, sendMail: async () => { effects.sends++; return true; }, resetTransporter: () => { effects.resets++; } },
    "../services/appSettings": {
      getRawEmailSetting: async () => { effects.reads++; return { smtp: { host: "private.example" } }; },
      saveEmailSetting: async () => { effects.writes++; return {}; },
    },
  };
  return mocks[name] || originalLoad.call(this, name, parent, ...rest);
};
const router = require("../routes/adminRoutes");
Module._load = originalLoad;

const app = express();
app.use(express.json());
app.use("/admin", router);
let server, origin;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { effects = { reads: 0, writes: 0, sends: 0, resets: 0 }; });

const endpoints = [["GET", "/settings/email"], ["PATCH", "/settings/email"], ["POST", "/settings/email/test"]];
const token = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
async function request(method, path, auth) {
  const response = await fetch(origin + "/admin" + path, {
    method,
    headers: { connection: "close", "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    ...(method !== "GET" ? { body: JSON.stringify({ smtp: { host: "attacker.example", password: "do-not-reflect" }, email: "test@example.test", clearSmtpPassword: true }) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
function noEmailEffects() {
  assert.deepEqual(effects, { reads: 0, writes: 0, sends: 0, resets: 0 });
}

for (const [method, path] of endpoints) {
  test(`${method} ${path} is retired for administrators without exposing or changing SMTP`, async () => {
    const result = await request(method, path, token("111111111111111111111111", "admin"));
    assert.equal(result.status, 410);
    assert.deepEqual(result.data, { message: "Email settings are managed by the system maintainer." });
    noEmailEffects();
  });
}
test("retired email endpoints still require authentication", async () => {
  for (const [method, path] of endpoints) assert.equal((await request(method, path)).status, 401);
  noEmailEffects();
});
test("students, organizers, and promoted organizers cannot access retired email endpoints", async () => {
  for (const [id, role] of [["222222222222222222222222", "student"], ["333333333333333333333333", "organizer"], ["444444444444444444444444", "organizer"]]) {
    for (const [method, path] of endpoints) assert.equal((await request(method, path, token(id, role))).status, 403);
  }
  noEmailEffects();
});
test("a student token cannot gain admin access by claiming an administrator role", async () => {
  for (const [method, path] of endpoints) assert.equal((await request(method, path, token("222222222222222222222222", "admin"))).status, 401);
  noEmailEffects();
});
