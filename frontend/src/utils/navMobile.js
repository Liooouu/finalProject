import { flatNavItems, navSections } from "./navItems";

/**
 * The phone navigation model.
 *
 * Below `md` there is exactly one way to move around: the fixed tab bar. It
 * carries the four destinations a role opens most; everything else lives in
 * the "More" sheet. Both surfaces read this file, so adding a destination or
 * changing what sits on the bar is a one-line edit — the sidebar keeps its own
 * full list for desktop.
 */
export const TAB_NAMES = {
  student: ["Dashboard", "Attend Events", "Community Service", "Notifications"],
  organizer: ["Dashboard", "Manage Events", "Manage Excuses", "Notifications"],
  admin: ["Dashboard", "Manage Events", "Manage Excuses", "Manage Users"],
};

// Tab captions are shorter than the sidebar labels so five slots fit at 360px.
const SHORT_LABEL = {
  Dashboard: "Home",
  "Attend Events": "Events",
  "Manage Events": "Events",
  "Manage Excuses": "Excuses",
  "Manage Users": "Users",
  "Community Service": "Service",
};

export const tabLabel = (name) => SHORT_LABEL[name] || name;

/** The tab bar's destinations, resolved against the shared nav config. */
export const tabItems = (role) => {
  const all = flatNavItems(role);
  return (TAB_NAMES[role] || [])
    .map((name) => all.find((item) => item.name === name))
    .filter(Boolean);
};

/**
 * Sections whose items are not already one tap away on the tab bar. Empty
 * sections drop out, so the sheet never shows a heading with nothing under it.
 */
export const overflowSections = (role) => {
  const onBar = new Set(TAB_NAMES[role] || []);
  return (navSections[role] || [])
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => !onBar.has(item.name)),
    }))
    .filter((section) => section.items.length > 0);
};
