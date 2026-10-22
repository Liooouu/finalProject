import React from "react";

const levelClass = {
  command: "fd-command",
  instrument: "fd-instrument",
  ledger: "fd-ledger",
};

const toneClass = {
  brand: "text-brand",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
  excused: "text-excused",
};

const accentValue = {
  brand: "var(--brand)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  info: "var(--info)",
  excused: "var(--excused)",
};

/**
 * Flight Deck panel — admin instrument surface with a compact rail.
 * Use command sparingly (one per page), instrument for metrics/charts,
 * and ledger for tables, queues and forms.
 */
const FlightPanel = ({
  as,
  level = "instrument",
  tone = "brand",
  eyebrow,
  title,
  subtitle,
  icon,
  status,
  statusTone = "ok",
  actions,
  footer,
  flush = false,
  glass = false,
  className = "",
  bodyClassName = "",
  style,
  children,
  ...rest
}) => {
  const Comp = as || "section";
  const hasRail = Boolean(eyebrow || title || subtitle || icon || status || actions);

  return (
    <Comp
      className={`fd-surface ${levelClass[level] || levelClass.instrument} ${
        glass ? "fd-glass" : ""
      } ${className}`}
      style={{ "--fd-accent": accentValue[tone] || accentValue.brand, ...style }}
      {...rest}
    >
      {hasRail && (
        <div className={`fd-rail ${level === "command" ? "fd-rail-command" : ""}`}>
          <div className="flex min-w-0 items-center gap-3">
            {icon && <span className="fd-rail-icon">{icon}</span>}
            <div className="min-w-0">
              {eyebrow && <p className="fd-eyebrow">{eyebrow}</p>}
              {title && <h3 className="fd-title">{title}</h3>}
              {subtitle && <p className="fd-subtitle">{subtitle}</p>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {status && (
              <span className={`fd-status ${toneClass[statusTone] || toneClass.ok}`}>
                <span
                  className={`fd-dot ${statusTone === "ok" ? "fd-dot-live" : ""}`}
                  aria-hidden="true"
                />
                {status}
              </span>
            )}
            {actions}
          </div>
        </div>
      )}

      <div className={`fd-body ${flush ? "fd-body-flush" : ""} ${bodyClassName}`}>
        {children}
      </div>

      {footer && <div className="fd-footer">{footer}</div>}
    </Comp>
  );
};

export default FlightPanel;
