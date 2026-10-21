import React from "react";
import Card from "./Card";

/**
 * BaseCard — shared card shell enforcing a consistent look across the app:
 * - same surface, radius, hairline and elevation as every other panel
 * - same header row: icon chip + title (left) and optional menu (right)
 * - body padding inherited from Card unless a page overrides it
 *
 * Every card on the dashboards and settings pages should use this instead of
 * hand-rolled Tailwind.
 */
const BaseCard = ({
  icon,
  title,
  description,
  menu,
  className = "",
  bodyClassName = "",
  children,
  compact = false,
  centerTitle = false,
}) => {
  return (
    <Card
      as="section"
      padding={compact ? "none" : "lg"}
      className={className}
    >
      {(icon || title || menu) && (
        <div
          className={`flex items-start gap-3 ${
            centerTitle ? "justify-center text-center" : "justify-between"
          } ${compact ? "p-5 pb-0" : "mb-4"}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-gradient-to-br from-[var(--brand-solid)] to-[var(--brand-2)] text-[15px] text-[var(--card-bg)] shadow-[0_10px_24px_-14px_rgba(15,23,42,0.65)] ring-1 ring-inset ring-white/25">
                {icon}
              </span>
            )}
            {(title || description) && (
              <div className="min-w-0">
                {title && (
                  <h3 className="truncate font-display text-[15px] font-semibold tracking-tight text-on">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="mt-0.5 truncate text-xs text-on-muted">{description}</p>
                )}
              </div>
            )}
          </div>
          {menu && !centerTitle && <div className="shrink-0">{menu}</div>}
        </div>
      )}
      <div className={`${compact && (icon || title || menu) ? "p-5 pt-4" : ""} ${bodyClassName}`}>
        {children}
      </div>
    </Card>
  );
};

export default BaseCard;
