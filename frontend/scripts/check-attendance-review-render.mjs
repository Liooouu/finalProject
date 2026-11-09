import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const browserGlobals = { window: { location: { pathname: '/organizer/dashboard/manual-attendance' } }, localStorage: { getItem: () => null } };
const originals = Object.fromEntries(Object.keys(browserGlobals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
try {
  for (const [key, value] of Object.entries(browserGlobals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const { default: Card } = await server.ssrLoadModule('/src/components/shared/AttendanceReviewCard.jsx');
  const request = { _id: 'test', source: 'id_photo', hasIdPhoto: true, status: 'pending', canReview: true, proposedStatus: 'present', proposedHours: 0, student: { name: 'Test Student', email: 'test@example.test' }, event: { title: 'CCIT Event' } };
  const render = (overrides = {}, reviewMode = true) => renderToString(React.createElement(Card, { request: { ...request, ...overrides }, reviewMode, selected: false, busy: false, onToggle() {}, onReview() {} }));
  const eligible = render();
  assert.match(eligible, /Loading ID/);
  assert.match(eligible, />Approve<\/button>/);
  assert.match(eligible, /I checked the evidence and time/);
  assert.doesNotMatch(eligible, /<img[^>]+src="https?:/);
  const own = render({ canReview: false });
  assert.doesNotMatch(own, />Approve<\/button>|Select request for/);
  assert.match(own, /Awaiting admin review/);
  assert.doesNotMatch(render({}, false), />Approve<\/button>|Select request for/);
  assert.doesNotMatch(render({ status: 'approved' }), />Approve<\/button>|Select request for/);
  assert.match(render({ hasIdPhoto: false }), /ID photo expired/);
  const conflict = render({ currentAttendance: { method: 'face', status: 'late' } });
  assert.match(conflict, /Different face attendance/);
  const { default: IdPhotoCheckin } = await server.ssrLoadModule('/src/components/organizer/IdPhotoCheckin.jsx');
  const desk = props => renderToString(React.createElement(IdPhotoCheckin, props));
  assert.match(desk({}), /Offline sync/);
  assert.match(desk({}), /No photos waiting on this device/);
  const event = { _id: '111111111111111111111111', status: 'live' };
  const revoked = desk({ event });
  assert.match(revoked, /Ask an administrator to assign you/);
  assert.doesNotMatch(revoked, /Prepare event/);
  assert.match(revoked, /Offline sync/);
  assert.match(desk({ event, canCapture: true }), /Prepare event/);
  console.log('PASS: eligible review, self-review exclusion, mine/completed views, private evidence, expired evidence, attendance conflicts, assignment gate and visible offline queue.');
} finally {
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  await server.close();
}
