import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import api from "../api/axios";
import TrackMark from "./shared/TrackMark";
import { portalName } from "../utils/nav";
import { navSections, isNavItemActive } from "../utils/navItems";

const COLLAPSE_KEY = "tracked.sidebar";

const Sidebar = ({ role, isOpen, onClose }) => {
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
  const [counts, setCounts] = useState({});
  const asideRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Mobile drawer: keep keyboard focus inside while it is open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const panel = asideRef.current;
    if (!panel) return undefined;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll('a, button, [href], [tabindex]:not([tabindex="-1"])')
      ).filter((node) => node.offsetParent !== null);

    const first = getFocusable()[0];
    first?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = getFocusable();
      if (!nodes.length) return;
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Lightweight pending-work badges. Only existing endpoints are used; a
  // failure just leaves the badge absent instead of breaking navigation.
  useEffect(() => {
    let alive = true;

    const load = async () => {
      const next = {};

      if (role === "organizer") {
        const [stats, pins] = await Promise.allSettled([
          api.get("/organizer/stats"),
          api.get("/admin/security/pin-reset-requests", { params: { status: "pending" } }),
        ]);
        if (stats.status === "fulfilled") {
          next.excuses = stats.value.data?.pendingExcuses || 0;
        }
        if (pins.status === "fulfilled") {
          next.pinResets = pins.value.data?.length || 0;
        }
      }

      if (role === "admin") {
        const [pins, appeals] = await Promise.allSettled([
          api.get("/admin/security/pin-reset-requests", { params: { status: "pending" } }),
          api.get("/admin/security/face-appeals", { params: { status: "pending" } }),
        ]);
        if (pins.status === "fulfilled") {
          next.pinResets = pins.value.data?.length || 0;
        }
        if (appeals.status === "fulfilled") {
          next.appeals = appeals.value.data?.length || 0;
        }
      }

      if (alive) setCounts(next);
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [role]);

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
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        ref={asideRef}
        aria-label={`${portalName[role] || "Portal"} navigation`}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-card/95 backdrop-blur-2xl transition-[transform,width] duration-300 ease-in-out md:static md:translate-x-0 ${
          collapsed ? "md:w-[78px]" : "md:w-64"
        } ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
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

          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-dim transition-colors hover:bg-card-alt hover:text-on md:hidden"
          >
            <FaTimes />
          </button>
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
                        onClick={() => {
                          navigate(item.path);
                          onClose();
                        }}
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
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-muted transition-colors hover:bg-card-alt hover:text-on md:inline-flex"
            >
              {collapsed ? <FaChevronRight className="text-[10px]" /> : <FaChevronLeft className="text-[10px]" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
