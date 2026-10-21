import React from "react";

/**
 * PageHeader — optional in-content header (title + subtitle + actions).
 * The global top bar owns the primary page title; use this for section
 * toolbars that carry their own controls (search, filters, actions).
 */
const PageHeader = ({ title, subtitle, actions, eyebrow, className = "" }) => {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        {title && (
          <h2 className="font-display text-xl font-semibold tracking-tight text-on">
            {title}
          </h2>
        )}
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-on-dim">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
};

export default PageHeader;
