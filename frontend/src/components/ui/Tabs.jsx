import React from "react";

/**
 * Tabs — underline navigation for page sections. Tabs: [{ key, label, count }]
 *
 * Rule of thumb: page sections use <Tabs>, filters and small view switches use
 * <SegmentedControl>. Both mark the selected item with brand text so the same
 * "switch view" control never looks purple on one screen and plain on another.
 */
const Tabs = ({ tabs = [], active, onChange, className = "" }) => (
  <div
    role="tablist"
    data-guide="tabs"
    className={`nice-scroll flex gap-1 overflow-x-auto border-b border-line ${className}`}
  >
    {tabs.map((tab) => {
      const selected = tab.key === active;
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={selected}
          data-guide-tab={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative shrink-0 px-3 py-2.5 text-[13px] font-medium transition-colors ${
            selected ? "rounded-t-lg bg-[var(--brand-solid)] text-white" : "text-on-dim hover:text-on"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {tab.label}
            {tab.count != null && (
              <span
                className={`num rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  selected ? "bg-white/20 text-white" : "bg-card-alt text-on-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </span>
          {selected && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)]" />
          )}
        </button>
      );
    })}
  </div>
);

export default Tabs;
