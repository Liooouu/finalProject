import React from "react";
import Card from "./Card";
import FlightPanel from "./FlightPanel";

/**
 * ChartCard — Card with a consistent header/body split for data panels.
 * Pass surface="flight" for the admin instrument treatment.
 */
const ChartCard = ({
  title,
  subtitle,
  eyebrow,
  actions,
  legend,
  children,
  className = "",
  bodyClassName = "",
  surface = "flight",
  inset = false,
  glass = true,
}) => {
  if (surface === "flight") {
    return (
      <FlightPanel
        level="instrument"
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={actions}
        className={className}
        bodyClassName={inset ? "p-4" : ""}
        glass={glass}
      >
        {legend && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">{legend}</div>
        )}
        {inset ? (
          <div className={`fd-well fd-plot p-3 ${bodyClassName}`}>{children}</div>
        ) : (
          <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
        )}
      </FlightPanel>
    );
  }

  return (
    <Card className={`flex flex-col ${className}`} padding="lg" variant="accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold tracking-tight text-on">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-on-muted">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {legend && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{legend}</div>}

      <div className={`mt-4 min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </Card>
  );
};

export default ChartCard;
