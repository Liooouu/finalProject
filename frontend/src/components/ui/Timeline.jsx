import React from "react";

const tones = {
  brand: "bg-brand/10 text-brand ring-brand/20",
  ok: "bg-ok/10 text-ok ring-ok/20",
  warn: "bg-warn/10 text-warn ring-warn/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
  info: "bg-info/10 text-info ring-info/20",
  excused: "bg-excused/10 text-excused ring-excused/20",
  muted: "bg-card-alt text-on-muted ring-line",
};

/**
 * Timeline — vertical activity feed. Items: { id, title, meta, time, icon, tone }.
 */
const Timeline = ({ items = [], empty = null }) => {
  if (!items.length) return empty;

  return (
    <ol className="relative">
      {items.map((item, index) => (
        <li key={item.id ?? index} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-px bg-line"
            />
          )}
          <span
            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] ring-1 ring-inset ${
              tones[item.tone] || tones.brand
            }`}
          >
            {item.icon}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-medium text-on">{item.title}</p>
              {item.time && (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-on-muted">
                  {item.time}
                </span>
              )}
            </div>
            {item.meta && <p className="mt-0.5 truncate text-xs text-on-dim">{item.meta}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
};

export default Timeline;
