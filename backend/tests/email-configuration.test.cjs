const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let saved = null;
const keys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_SECURE', 'MAIL_FROM', 'APP_URL'];
const environment = Object.fromEntries(keys.map(key => [key, process.env[key]]));
Module._load = function(name, parent, ...rest) {
  if (name === '../models/Setting' && parent?.filename.endsWith('appSettings.js')) return { findOne: async () => saved };
  if (name === 'mongoose' && parent?.filename.endsWith('appSettings.js')) return { connection: { readyState: 1 } };
  return original.call(this, name, parent, ...rest);
};
const { getEmailSettings, invalidateEmailSettings } = require('../services/appSettings');
Module._load = original;
beforeEach(() => {
  for (const key of keys) delete process.env[key];
  invalidateEmailSettings();
  saved = { smtp: { host: 'legacy.example.test', port: 465, user: 'old@example.test', passEncrypted: 'sealed-old', from: 'Old <old@example.test>', appUrl: 'http://localhost:5173' }, templates: { notification: { title: 'Custom title' } } };
});
after(() => {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
test('complete hosting settings replace saved SMTP as a coherent transport', async () => {
  Object.assign(process.env, { SMTP_HOST: 'smtp.new.example.test', SMTP_USER: 'new@example.test', SMTP_PASS: 'new-secret', SMTP_PORT: '587', MAIL_FROM: 'TrackED <new@example.test>', APP_URL: 'https://tracked.example.test' });
  const settings = await getEmailSettings();
  assert.equal(settings.configurationSource, 'environment');
  assert.equal(settings.smtp.host, 'smtp.new.example.test');
  assert.equal(settings.smtp.user, 'new@example.test');
  assert.equal(settings.smtp.port, 587);
  assert.equal(settings.smtp.secure, false);
  assert.equal(settings.smtp.passEncrypted, '');
  assert.equal(settings.smtp.from, 'TrackED <new@example.test>');
  assert.equal(settings.smtp.appUrl, 'https://tracked.example.test');
  assert.equal(settings.templates.notification.title, 'Custom title');
});
test('legacy credentials stay paired while the hosting configuration is incomplete', async () => {
  Object.assign(process.env, { SMTP_HOST: 'incomplete.example.test', SMTP_PASS: 'unrelated-secret', SMTP_SECURE: 'false', APP_URL: 'https://tracked.example.test' });
  const settings = await getEmailSettings();
  assert.equal(settings.configurationSource, 'legacy-database');
  assert.equal(settings.smtp.host, 'legacy.example.test');
  assert.equal(settings.smtp.user, 'old@example.test');
  assert.equal(settings.smtp.passEncrypted, 'sealed-old');
  assert.equal(settings.smtp.secure, true);
  assert.equal(settings.smtp.appUrl, 'https://tracked.example.test');
});
test('environment STARTTLS settings work without a legacy settings document', async () => {
  saved = null;
  Object.assign(process.env, { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'sender@example.test', SMTP_PASS: 'secret', SMTP_PORT: '587', SMTP_SECURE: 'false' });
  const settings = await getEmailSettings();
  assert.equal(settings.smtp.host, 'smtp.example.test');
  assert.equal(settings.smtp.secure, false);
  assert.deepEqual(settings.templates.notification, {});
});
