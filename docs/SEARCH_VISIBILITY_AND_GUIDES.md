# Search visibility and the built-in guide

The public landing page and Terms page remain discoverable. Auth, portals,
stations, API responses and uploaded assets return `X-Robots-Tag: noindex,
nofollow, nosnippet`. The SPA also updates the robots meta tag on navigation.
The two-container deployment applies the headers in
`frontend/nginx/default.conf.template`; the single-container/API deployment
uses `backend/services/searchVisibility.js`.

`robots.txt` allows crawling so search engines can read the noindex headers.
Do not add `Disallow: /` as a substitute: an already-discovered URL may remain
listed if the crawler cannot see noindex. Google must revisit existing URLs;
Search Console's removal tool can temporarily hide an existing result sooner.
Reference: https://developers.google.com/search/docs/crawling-indexing/block-indexing

This does not make URLs secret or replace authorization. Portal records still
require the existing signed-in role checks. Compiled frontend JavaScript must
be delivered to browsers; a public GitHub repository remains a separate public
source. Directory listing is disabled; source/config probes and source maps
return 404 in production. No secrets were moved to the frontend.

## Tutorials

The question-mark Help button opens a page-specific guide with topics covering
the current role. Public pages and stations have manual help. Portals show the
guide automatically on the first visit to each page and supported section tab,
after account data and required enrollment are ready. The tour highlights real
navigation tabs, card headers and controls, with short descriptions and examples.
Closing, skipping or finishing remembers only that page/section, not every page.

`PATCH /api/account/tutorial` saves version 2 with a validated page key against
the authenticated account and active role, using an idempotent set update. Version
1 remains compatible with earlier clients. The client cannot choose another
account or another role. `tutorialPages` is returned by GET account, so the
completion survives sign-out and a new device. A browser-local completion flag
prevents repeat prompts during temporary API failure and is synced on a later
visit. Clearing local storage only loses this fallback, not saved server progress.

Help can always replay the guide without resetting completion. Guide steps and
highlights never submit attendance, change grades/years, approve requests or
open a camera automatically. The non-modal guide lets users switch pages while
it is open; mobile highlights use the hamburger when the sidebar is hidden.
Maintain `frontend/src/data/tutorials.js` and `guidedTours.js` when a
workflow changes. Account creation, email verification, recovery, enrollment,
portal permissions and attendance policies are unchanged by the auth redesign.
