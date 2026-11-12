# Stone and Charcoal UI

The shared theme is imported once by `frontend/src/main.jsx` from
`frontend/src/styles/stone-charcoal.css`. It replaces the earlier admin-only
Forest & Stone trial. All portals, authentication, public pages and portaled
dialogs inherit the same palette.

- Light: warm stone surfaces and forest green actions.
- Dark: neutral charcoal surfaces and readable sage accents.
- Raised cards and buttons use paired soft shadows; fields and selected
  navigation use inset shadows. Text, labels and status icons remain explicit.
- Mobile shadows are smaller. No blur filters, image assets, camera transforms,
  API changes or attendance behavior are introduced by the theme.

The face station keeps its camera pixels and on-camera overlays unchanged;
only its surrounding chrome, record summaries and buttons follow the theme.
The original TrackED symbol and existing page layouts remain in place.
