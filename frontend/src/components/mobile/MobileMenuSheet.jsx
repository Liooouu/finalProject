import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaTimes } from "react-icons/fa";
import { navSections, isNavItemActive } from "../../utils/navItems";
import { useNavCounts } from "../../utils/navCounts";
import { prefetchRoute } from "../../utils/prefetchRoutes";

/** Mobile navigation drawer shared by all three portals. */
const MobileMenuSheet = ({ open, onClose, role }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useNavCounts(role);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the sheet itself rather than its first control, so opening it does
    // not paint a focus ring on the close button.
    panelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const buttons = panelRef.current?.querySelectorAll('button:not(:disabled),a[href]');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const desktop = window.matchMedia("(min-width:768px)");
    const onResize = () => { if (desktop.matches) onClose(); };
    desktop.addEventListener("change", onResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sections = navSections[role] || [];

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div
        className="absolute inset-0 bg-slate-950/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="All sections"
        tabIndex={-1}
        className="nice-scroll absolute inset-y-0 left-0 w-[min(320px,88vw)] overflow-y-auto border-r border-line bg-[var(--panel-bg)] pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-[var(--elev-3)] outline-none"
      >
        <div className="sticky top-0 z-10 flex items-end justify-between gap-3 border-b border-line/70 bg-[var(--panel-bg)] px-4 pb-3 pt-4">
          <p className="font-display text-sm font-bold tracking-tight text-on">All sections</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card/60 text-on-dim transition-colors active:bg-card-alt"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        <nav className="space-y-5 px-4 pb-2 pt-4">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-on-muted">
                {section.label}
              </p>

              <div className="grid gap-2">
                {section.items.map((item) => {
                  const active = isNavItemActive(item, location.pathname);
                  const count = item.badge ? counts[item.badge] || 0 : 0;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        navigate(item.path);
                        onClose();
                      }}
                      onTouchStart={() => prefetchRoute(item.path)}
                      onMouseEnter={() => prefetchRoute(item.path)}
                      className={`flex min-h-[56px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                        active
                          ? "border-brand/30 bg-brand/10 text-brand"
                          : "border-line bg-card/70 text-on-dim active:bg-card-alt"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[14px] ${
                          active ? "bg-brand/15 text-brand" : "bg-card-alt text-on-muted"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] leading-tight">{item.name}</span>
                      {count > 0 && (
                        <span className="num shrink-0 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default MobileMenuSheet;
