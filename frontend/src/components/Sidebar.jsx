import React, { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import TrackMark from "./shared/TrackMark";
import { portalName } from "../utils/nav";
import { navSections, isNavItemActive } from "../utils/navItems";
import { useNavCounts } from "../utils/navCounts";
import { prefetchRoute } from "../utils/prefetchRoutes";

const COLLAPSE_KEY = "tracked.sidebar";

// Desktop/tablet rail. Phones get the bottom tab bar + "More" sheet instead
// (components/mobile), so this element is hidden below `md` rather than being
// an off-canvas drawer — that removed the hamburger that duplicated the bar.
const Sidebar = ({ role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sections = navSections[role] || [];

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const counts = useNavCounts(role);

  // Lightweight pending-work badges, shared with the mobile tab bar so both
  // surfaces read the same numbers from a single poll loop (see utils/navCounts).

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "collapsed" : "expanded");
      } catch {
        /* storage unavailable — collapse still works for this session */
      }
      return next;
    });
  }, []);

  return (
    <aside
      aria-label={`${portalName[role] || "Portal"} navigation`}
      className={`hidden w-64 shrink-0 flex-col border-r border-line bg-card md:flex ${
        collapsed ? "md:w-[78px]" : "md:w-64"
      }`}
    >
        {/* Brand */}
        <div
          className={`flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 ${
            collapsed ? "md:justify-center md:px-0" : ""
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-[var(--glow-brand)]">
            <TrackMark className="h-7 w-7" />
          </span>

          <div className={`min-w-0 leading-tight ${collapsed ? "md:hidden" : ""}`}>
            <p className="font-display text-[17px] font-bold tracking-tight text-on">
              Track<span className="brand-text">ED</span>
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-on-muted">
              {portalName[role] || "Portal"}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="nice-scroll flex-1 overflow-y-auto px-3 py-5">
          {sections.map((section, sectionIndex) => (
            <div
              key={section.label}
              className={sectionIndex < sections.length - 1 ? "mb-5" : ""}
            >
              {collapsed && sectionIndex > 0 && (
                <div className="mb-2 hidden border-t border-line/70 md:block" />
              )}
              <p
                className={`px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-muted ${
                  collapsed ? "md:hidden" : ""
                }`}
              >
                {section.label}
              </p>

              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isNavItemActive(item, location.pathname);
                  const count = item.badge ? counts[item.badge] || 0 : 0;

                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        title={collapsed ? item.name : undefined}
                        aria-current={active ? "page" : undefined}
                        onClick={() => navigate(item.path)}
                        onMouseEnter={() => prefetchRoute(item.path)}
                        onFocus={() => prefetchRoute(item.path)}
                        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all duration-150 ${
                          active
                            ? "bg-brand/10 font-semibold text-brand"
                            : "text-on-dim hover:bg-card-alt/80 hover:text-on"
                        } ${collapsed ? "md:justify-center md:gap-0 md:px-0" : ""}`}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--brand)] to-[var(--brand-2)]"
                          />
                        )}

                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[14px] transition-colors ${
                            active
                              ? "bg-brand/15 text-brand"
                              : "text-on-muted group-hover:text-on"
                          }`}
                        >
                          {item.icon}
                        </span>

                        <span className={`truncate ${collapsed ? "md:hidden" : ""}`}>
                          {item.name}
                        </span>

                        {count > 0 && (
                          <span
                            className={`num ml-auto shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand ${
                              collapsed ? "md:hidden" : ""
                            }`}
                          >
                            {count > 9 ? "9+" : count}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-line p-3">
          <div
            className={`flex items-center gap-2 ${
              collapsed ? "md:justify-center" : "justify-between"
            }`}
          >
            <div className={`min-w-0 px-2 ${collapsed ? "md:hidden" : ""}`}>
              <p className="truncate text-[11px] font-medium text-on-dim">
                Events Attendance
              </p>
              <p className="text-[10px] text-on-muted">Management System</p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-muted transition-colors hover:bg-card-alt hover:text-on"
            >
              {collapsed ? <FaChevronRight className="text-[10px]" /> : <FaChevronLeft className="text-[10px]" />}
            </button>
          </div>
        </div>
      </aside>
  );
};

export default Sidebar;
