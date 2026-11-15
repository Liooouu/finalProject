const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let smtp, created, messages, error, result, notificationGate, closed;
const oldPassword = process.env.SMTP_PASS, oldReply = process.env.MAIL_REPLY_TO;
Module._load = function(name, parent, ...rest) {
  if (parent?.filename.replaceAll('\\', '/').endsWith('/services/mailer.js')) {
    if (name === 'nodemailer') return { createTransport: options => {
      created.push(options);
      const index = created.length - 1;
      return { close() { closed++; }, sendMail: async message => { messages.push(message); if (index === 0 && notificationGate) await notificationGate; if (error) throw error; return result; } };
    } };
    if (name === './appSettings') return { getEmailSettings: async () => ({ smtp }) };
    if (name === '../utils/secretBox') return { open: value => value === 'bad' ? '' : 'legacy-password' };
  }
  return original.call(this, name, parent, ...rest);
};
const { sendMail, isMailEnabled, resetTransporter } = require('../services/mailer');
Module._load = original;
beforeEach(() => {
  resetTransporter();
  process.env.SMTP_PASS = 'environment-password'; delete process.env.MAIL_REPLY_TO;
  smtp = { host: 'smtp.example.test', port: 587, secure: false, user: 'sender@example.test', from: '', passEncrypted: '' };
  created = []; messages = []; error = null; notificationGate = null; closed = 0; result = { accepted: ['student@example.test'] };
});
after(() => {
  resetTransporter();
  if (oldPassword === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = oldPassword;
  if (oldReply === undefined) delete process.env.MAIL_REPLY_TO; else process.env.MAIL_REPLY_TO = oldReply;
});
const message = { to: 'student@example.test', subject: 'TrackED: event update', html: '<p>Updated event.</p>', text: 'Updated event.' };
test('submissions reuse TLS connections and retain matching message formats without fake priority', async () => {
  assert.equal(await sendMail(message), true); assert.equal(await sendMail(message), true);
  assert.equal(created.length, 1); assert.equal(created[0].pool, true);
  assert.equal(created[0].maxConnections, 1); assert.equal(created[0].requireTLS, true);
  assert.equal(created[0].auth.pass, 'environment-password');
  assert.deepEqual(messages[0].from, { name: 'TrackED', address: 'sender@example.test' });
  assert.equal(messages[0].text, message.text); assert.equal(messages[0].html, message.html);
  assert.equal(messages[0].priority, undefined); assert.equal(messages[0].headers, undefined);
});

test('account codes use a reserved connection while an announcement is blocked', async () => {
  let release;
  notificationGate = new Promise(resolve => { release = resolve; });
  const announcement = sendMail(message);
  await new Promise(resolve => setImmediate(resolve));
  try {
    const accepted = await Promise.race([
      sendMail({ ...message, category: 'account' }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Account code blocked behind announcements')), 500); timer.unref(); }),
    ]);
    assert.equal(accepted, true);
    assert.equal(await sendMail({ ...message, category: 'account' }), true);
    assert.equal(created.length, 2);
    resetTransporter();
    assert.equal(closed, 2);
  } finally { release(); await announcement; }
});

test('a missing SMTP configuration is not cached after it is repaired', async () => {
  smtp.host = '';
  assert.equal(await sendMail(message), false);
  smtp.host = 'smtp.example.test';
  assert.equal(await sendMail(message), true);
  assert.equal(created.length, 1);
});
test('a verified custom From identity and optional reply address are retained', async () => {
  smtp.from = 'TrackED <verified@example.test>'; process.env.MAIL_REPLY_TO = 'support@example.test';
  await sendMail(message);
  assert.equal(messages[0].from, 'TrackED <verified@example.test>');
  assert.equal(messages[0].replyTo, 'support@example.test');
});
test('SMTP rejection or submission errors are not reported as accepted', async () => {
  const old = console.error; console.error = () => {};
  try {
    result = { accepted: [], rejected: [message.to] };
    assert.equal(await sendMail(message), false);
    error = Object.assign(new Error('rejected'), { code: 'EENVELOPE', responseCode: 550 });
    assert.equal(await sendMail(message), false);
  } finally { console.error = old; }
});
test('an unreadable legacy password cannot use another provider environment password', async () => {
  smtp.passEncrypted = 'bad';
  assert.equal(await isMailEnabled(), false); assert.equal(await sendMail(message), false);
  assert.equal(created.length, 0);
});
