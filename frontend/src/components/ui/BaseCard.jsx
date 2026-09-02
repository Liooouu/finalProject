import React from "react";

/**
 * BaseCard — shared card shell enforcing a consistent look across the app:
 * - same border-radius (rounded-xl)
 * - same body padding scale (p-5 for the card body, p-4 for compact widgets)
 * - same subtle elevation (border + soft shadow, matching the dark theme tokens)
 * - same header row: icon + title (left) and optional "..." menu (right)
 *
 * Every card on the dashboards should use this instead of hand-rolled Tailwind.
 */
const BaseCard = ({
  icon,
  title,
  menu,
  className = "",
  bodyClassName = "",
  children,
  compact = false,
  centerTitle = false,
}) => {
  return (
    <div
      className={`bg-card border border-line rounded-xl shadow-sm shadow-black/5 ${
        compact ? "" : "p-5"
      } ${className}`}
    >
      {(icon || title || menu) && (
        <div
          className={`flex items-center mb-4 ${
            centerTitle ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-on-dim text-lg flex-shrink-0">{icon}</span>}
            {title && (
              <h3
                className={`text-on font-semibold text-base truncate ${
                  centerTitle ? "text-center" : ""
                }`}
              >
                {title}
              </h3>
            )}
          </div>
          {menu && !centerTitle && <div className="flex-shrink-0">{menu}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};

export default BaseCard;
