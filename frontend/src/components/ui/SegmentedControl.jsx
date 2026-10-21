import React from "react";

/**
 * SegmentedControl — iOS-style filter switch for small option sets.
 * Options: [{ value, label, count, icon }]
 */
const SegmentedControl = ({
  options = [],
  value,
  onChange,
  className = "",
  ariaLabel = "View options",
}) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className={`nice-scroll inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-card-alt/60 p-1 ${className}`}
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(option.value)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
            active
              ? "bg-card text-on shadow-[var(--elev-1)]"
              : "text-on-dim hover:text-on"
          }`}
        >
          {option.icon && <span className="text-[11px]">{option.icon}</span>}
          {option.label}
          {option.count != null && (
            <span
              className={`num rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                active ? "bg-brand/10 text-brand" : "bg-card text-on-muted"
              }`}
            >
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default SegmentedControl;
