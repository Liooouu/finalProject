import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaEllipsisH } from "react-icons/fa";
import { isNavItemActive } from "../../utils/navItems";
import { tabItems, tabLabel, overflowSections } from "../../utils/navMobile";
import { useNavCounts } from "../../utils/navCounts";
import { prefetchRoute } from "../../utils/prefetchRoutes";

/**
 * MobileTabBar — the phone's primary (and only) navigation.
 *
 * Four destinations plus "More"; everything else is one tap away in the sheet
 * that "More" opens. The badge counts are shared with the desktop sidebar
 * through `useNavCounts`, so both surfaces read the same store.
 */
const MobileTabBar = ({ role, onMore, menuOpen = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useNavCounts(role);

  const items = tabItems(role);

  // Pending work can live behind "More" (excuses and reviews), so the trigger
  // carries a dot rather than hiding the queue entirely.
  const moreSections = overflowSections(role);
  const moreCount = moreSections
    .flatMap((section) => section.items)
    .reduce((sum, item) => sum + (item.badge ? counts[item.badge] || 0 : 0), 0);

  // Tapping the tab you are already on returns to the top of the page instead
  // of doing nothing — the usual way back up on a long mobile list.
  const go = (item, active) => {
    if (!active) {
      navigate(item.path);
      return;
    }
    const scroller = document.querySelector("main");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--app-base)]/95 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = isNavItemActive(item, location.pathname);
          const count = item.badge ? counts[item.badge] || 0 : 0;

          return (
            <button
              key={item.path}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => go(item, active)}
              onTouchStart={() => prefetchRoute(item.path)}
              onMouseEnter={() => prefetchRoute(item.path)}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                active ? "text-brand" : "text-on-muted active:text-on"
              }`}
            >
              <span className="relative text-[17px] leading-none">
                {item.icon}
                {count > 0 && (
                  <span className="num absolute -right-2.5 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-solid)] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[var(--app-base)]">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{tabLabel(item.name)}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)]"
                />
              )}
            </button>
          );
        })}

        {moreSections.length > 0 && <button
          type="button"
          onClick={onMore}
          aria-label="All sections"
          aria-expanded={menuOpen}
          className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
            menuOpen ? "text-brand" : "text-on-muted active:text-on"
          }`}
        >
          <span className="relative text-[17px] leading-none">
            <FaEllipsisH />
            {moreCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-[var(--warn)] ring-2 ring-[var(--app-base)]"
              />
            )}
          </span>
          <span>More</span>
          {menuOpen && (
            <span
              aria-hidden="true"
              className="absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)]"
            />
          )}
        </button>}
      </div>
    </nav>
  );
};

export default MobileTabBar;
