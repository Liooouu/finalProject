import React from "react";

/**
 * RouteFallback — shown while a lazily-loaded page chunk is in flight.
 *
 * It mirrors the shape of a dashboard page (hero, a row of KPI tiles, one
 * panel) so a slow chunk looks like a page still assembling rather than a
 * blank screen or a spinner that then shifts the layout.
 */
const RouteFallback = () => (
  <div className="space-y-4" role="status" aria-live="polite">
    <span className="sr-only">Loading page</span>
    <div className="skeleton h-28 rounded-2xl" />
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-20 rounded-xl sm:h-32" />
      ))}
    </div>
    <div className="skeleton h-56 rounded-2xl" />
  </div>
);

export default RouteFallback;
