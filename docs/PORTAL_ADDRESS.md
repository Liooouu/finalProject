# Portal address display

Internal admin, organizer and student screens display `/portal` in the browser
address bar. Their real React route, filters and fragment are retained in the
current browser history entry, not in the displayed URL. Refresh and browser
Back/Forward restore that entry. Old internal links are accepted and immediately
masked by the application. A copied `/portal` link opens the current session's
dashboard; it does not share the sender's selected record or filters.

The public landing, sign-in, terms and supervised face-station links keep their
own addresses. Role switching reloads `/portal` using the newly scoped session.
Authentication helpers read the internal route to preserve per-role tokens.

This is a presentation feature, not a security boundary. Internal routes remain
inspectable in application code/history, and API calls remain visible to browser
developer tools. ProtectedRoute and server authentication/authorization still
control access; the search-engine noindex policy is independent of URL masking.

Validation: `node --test scripts/portal-router.test.mjs` from frontend, existing
auth and portal-history checks, production build, and browser navigation checks.
