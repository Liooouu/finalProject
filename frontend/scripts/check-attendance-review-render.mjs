import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
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
  assert.match(own, /Another authorized reviewer/);
  assert.doesNotMatch(render({}, false), />Approve<\/button>|Select request for/);
  assert.doesNotMatch(render({ status: 'approved' }), />Approve<\/button>|Select request for/);
  assert.match(render({ hasIdPhoto: false }), /ID photo expired/);
  const conflict = render({ currentAttendance: { method: 'face', status: 'late' } });
  assert.match(conflict, /Different face attendance/);
  console.log('PASS: eligible review, self-review exclusion, mine/completed views, private evidence, expired evidence, attendance conflicts.');
} finally { await server.close(); }
