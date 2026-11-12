const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { searchVisibility } = require('../services/searchVisibility');
const app = require('express')();
app.use(searchVisibility);
app.use((req, res) => res.json({ publicShell: true }));
const server = app.listen(0, '127.0.0.1');
after(() => new Promise(resolve => server.close(resolve)));
test('public landing stays discoverable; internal pages and API responses are noindex', async () => {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  for (const path of ['/', '/terms', '/auth/signup', '/admin/dashboard/users', '/organizer/dashboard/reviews/excuses', '/student/dashboard', '/check-in/sample-token', '/api/account', '/uploads/sample.jpg']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    assert.equal(response.headers.get('x-robots-tag'), ['/', '/terms'].includes(path) ? 'index, follow' : 'noindex, nofollow, nosnippet');
  }
});
test('source and configuration probes return 404 instead of a working app shell', async () => {
  for (const path of ['/.env', '/.env.production', '/.git/config', '/backend/server.js', '/src/App.jsx', '/node_modules/package.json', '/assets/example.js.map']) {
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}${path}`)).status, 404);
  }
});
