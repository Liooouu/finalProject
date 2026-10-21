import React from "react";
import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";

/**
 * Breadcrumbs — compact trail rendered in the top bar.
 * Items: [{ label, to? }]
 */
const Breadcrumbs = ({ items = [] }) => (
  <nav aria-label="Breadcrumb" className="min-w-0">
    <ol className="flex items-center gap-1.5 overflow-hidden text-[11px] font-medium text-on-muted">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && <FaChevronRight className="shrink-0 text-[7px] opacity-60" aria-hidden="true" />}
            {item.to && !last ? (
              <Link
                to={item.to}
                className="truncate rounded transition-colors hover:text-on"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`truncate ${last ? "text-on-dim" : ""}`} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumbs;
