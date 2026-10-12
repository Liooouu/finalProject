import React from "react";
import { FaDirections, FaStreetView } from "react-icons/fa";
import { eventMapEmbedUrl, eventDirectionsUrl, eventStreetViewUrl } from "../../utils/maps";

const linkClasses =
  "inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-on-dim transition-colors hover:bg-card-alt hover:text-on";

const EventMap = ({ event, className = "h-56 w-full", placeholder = true, frame = true }) => {
  const url = eventMapEmbedUrl(event);
  const directionsUrl = eventDirectionsUrl(event);
  const streetViewUrl = eventStreetViewUrl(event);

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
    <div className="space-y-2">
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
      <div className="flex flex-wrap gap-2">
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            <FaDirections /> Get directions
          </a>
        )}
        {streetViewUrl && (
          <a
            href={streetViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            <FaStreetView /> Street View
          </a>
        )}
      </div>
    </div>
  );
};

export default EventMap;
