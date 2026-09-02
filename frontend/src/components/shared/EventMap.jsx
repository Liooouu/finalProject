import React from "react";
import { eventMapEmbedUrl } from "../../utils/maps";

const EventMap = ({ event, className = "h-56 w-full", placeholder = true, frame = true }) => {
  const url = eventMapEmbedUrl(event);

  if (!url) {
    if (!placeholder) return null;
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-line px-4 text-center text-sm text-on-muted ${className}`}
      >
        No map location set
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden ${frame ? "rounded-xl border border-line bg-card-alt" : ""} ${className}`}
    >
      <iframe
        title="Event location map"
        src={url}
        className="h-full w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
};

export default EventMap;