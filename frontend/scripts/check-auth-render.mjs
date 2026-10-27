import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, matchRoutes } from 'react-router-dom';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: AuthPage } = await server.ssrLoadModule('/src/pages/auth/AuthPage.jsx');
  const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.jsx');
  const { default: SecuritySettings } = await server.ssrLoadModule('/src/components/settings/SecuritySettings.jsx');
  const render = (Component, path) => renderToString(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(ThemeProvider, null, React.createElement(Component))));
  const login = render(AuthPage, '/auth');
  assert.match(login, /Forgot Password\?/);
  assert.match(login, /Sign In/);
  assert.doesNotMatch(login, /security PIN|trusted device|Forgot your security/);
  const signup = render(AuthPage, '/auth/signup');
  assert.match(signup, /Create Account/);
  assert.doesNotMatch(signup, /security PIN/);
  const security = render(SecuritySettings, '/student/dashboard/security');
  assert.match(security, /Face verification/);
  assert.doesNotMatch(security, /Security PIN|Trusted devices|Rotate my PIN|PIN recovery/);
  const dashboard = fs.readFileSync('src/pages/StudentDashboard.jsx', 'utf8');
  const enrollTarget = dashboard.match(/to="([^"]+)"/)[1];
  assert.equal(matchRoutes([{path:'/student/dashboard',children:[{path:'profile',id:'enrollment'}]}],enrollTarget)?.at(-1).route.id, 'enrollment');
  // Verify signing out of onboarding also removes the student-scoped token.
  const store = new Map([['token','old'], ['token_student','old'], ['token_admin','admin']]);
  globalThis.localStorage = { getItem: (k) => store.get(k), removeItem: (k) => store.delete(k) };
  const { clearAuth } = await server.ssrLoadModule('/src/utils/auth.js');
  clearAuth('student');
  assert.equal(store.has('token_student'), false);
  assert.equal(store.get('token_admin'), 'admin');
  delete globalThis.localStorage;
  console.log('PASS: login, signup and face settings render without PIN controls; enrollment link and onboarding sign-out verified.');
} finally { await server.close(); }
