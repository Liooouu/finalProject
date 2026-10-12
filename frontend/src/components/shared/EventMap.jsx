import React, { useCallback, useState } from "react";
import { FaDirections, FaStreetView } from "react-icons/fa";
import {
  eventMapEmbedUrl,
  eventDirectionsUrl,
  eventStreetViewUrl,
  eventDirectionsEmbedUrl,
  eventStreetViewEmbedUrl,
  eventMapQuery,
  geocodeQuery,
} from "../../utils/maps";
import MapModal from "./MapModal";

const linkClasses =
  "inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-on-dim transition-colors hover:bg-card-alt hover:text-on";

const EventMap = ({ event, className = "h-56 w-full", placeholder = true, frame = true, fill = false }) => {
  const url = eventMapEmbedUrl(event);
  const directionsUrl = eventDirectionsUrl(event);
  const streetViewUrl = eventStreetViewUrl(event);

  const [dialog, setDialog] = useState(null); // null | "directions" | "streetview"
  const [embedSrc, setEmbedSrc] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | promptOrigin | error
  const [originInput, setOriginInput] = useState("");
  const [message, setMessage] = useState("");

  const closeDialog = useCallback(() => {
    setDialog(null);
    setEmbedSrc("");
    setPhase("idle");
    setOriginInput("");
    setMessage("");
  }, []);

  const openDirections = useCallback(() => {
    setDialog("directions");
    setEmbedSrc("");
    setMessage("");
    if (!navigator.geolocation) {
      setPhase("promptOrigin");
      return;
    }
    setPhase("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEmbedSrc(eventDirectionsEmbedUrl(event, `${pos.coords.latitude},${pos.coords.longitude}`));
        setPhase("idle");
      },
      () => setPhase("promptOrigin"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [event]);

  const submitOrigin = useCallback(
    async (e) => {
      e.preventDefault();
      const value = originInput.trim();
      if (!value) return;
      setPhase("loading");
      setMessage("");
      const coords = await geocodeQuery(value);
      if (!coords) {
        setPhase("promptOrigin");
        setMessage("Couldn't find that starting point — try a more specific address.");
        return;
      }
      setEmbedSrc(eventDirectionsEmbedUrl(event, `${coords[0]},${coords[1]}`));
      setPhase("idle");
    },
    [event, originInput]
  );

  const openStreetView = useCallback(async () => {
    setDialog("streetview");
    setEmbedSrc("");
    setMessage("");
    setPhase("loading");
    const coords = await geocodeQuery(eventMapQuery(event));
    if (!coords) {
      setPhase("error");
      setMessage("We couldn't locate this event on the map for Street View.");
      return;
    }
    setEmbedSrc(eventStreetViewEmbedUrl(coords));
    setPhase("idle");
  }, [event]);

  if (!url) {
    if (!placeholder) return null;
    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-line px-4 text-center text-sm text-on-muted ${
          fill ? "h-full" : ""
        } ${className}`}
      >
        No map location set
      </div>
    );
  }

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col gap-2" : "space-y-2"}>
      <div
        className={`overflow-hidden ${fill ? "min-h-0 flex-1" : ""} ${
          frame ? "rounded-xl border border-line bg-card-alt" : ""
        } ${className}`}
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
          <button type="button" onClick={openDirections} className={linkClasses}>
            <FaDirections /> Get directions
          </button>
        )}
        {streetViewUrl && (
          <button type="button" onClick={openStreetView} className={linkClasses}>
            <FaStreetView /> Street View
          </button>
        )}
      </div>

      <MapModal
        open={dialog !== null}
        title={dialog === "directions" ? "Directions" : "Street View"}
        src={embedSrc}
        externalUrl={dialog === "directions" ? directionsUrl : streetViewUrl}
        error={phase === "error" ? message : ""}
        onClose={closeDialog}
      >
        {phase === "promptOrigin" && (
          <form onSubmit={submitOrigin} className="w-full max-w-sm space-y-3 px-6">
            <p className="text-sm text-on-dim">
              We couldn't use your current location. Where are you starting from?
            </p>
            {message && <p className="text-sm text-red-600 dark:text-red-400">{message}</p>}
            <input
              type="text"
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="Enter a starting address"
              className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-on placeholder-on-muted transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Show directions
            </button>
          </form>
        )}
      </MapModal>
    </div>
  );
};

export default EventMap;
