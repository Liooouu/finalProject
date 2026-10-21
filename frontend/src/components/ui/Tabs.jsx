import React from "react";

/**
 * Tabs — underline navigation. Tabs: [{ key, label, count }]
 */
const Tabs = ({ tabs = [], active, onChange, className = "" }) => (
  <div
    role="tablist"
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
          onClick={() => onChange(tab.key)}
          className={`relative shrink-0 px-3 py-2.5 text-[13px] font-medium transition-colors ${
            selected ? "text-brand" : "text-on-dim hover:text-on"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {tab.label}
            {tab.count != null && (
              <span
                className={`num rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  selected ? "bg-brand/10 text-brand" : "bg-card-alt text-on-muted"
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
