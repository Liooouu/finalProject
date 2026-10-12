// Google Maps Embed API key. Public by design (it ships in the bundle) — it
// must be restricted by HTTP referrer in Google Cloud. When unset, the app
// falls back to the keyless embed and outbound Google Maps links, so a
// checkout without a key still works.
const MAPS_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || "";

export const mapsEmbedKeyPresent = Boolean(MAPS_EMBED_KEY);

// Location text shared by the embed and the outbound links: the pinned
// `mapQuery` when the organizer set one, otherwise the plain location string.
export const eventMapQuery = (event) =>
  event?.mapQuery?.trim() || event?.location?.trim() || "";

// "lat, lng" pair, if the pinned location is a coordinate string (the map
// picker accepts coordinates as well as addresses).
export const parseCoords = (value) => {
  const parts = String(value)
    .split(",")
    .map((s) => parseFloat(s.trim()));
  if (
    parts.length === 2 &&
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1]) &&
    Math.abs(parts[0]) <= 90 &&
    Math.abs(parts[1]) <= 180
  ) {
    return parts;
  }
  return null;
};

// Forward-geocode a free-text place to [lat, lng]. Nominatim is keyless but
// rate-limited, so successful results are cached for the session and a value
// that already looks like coordinates is returned without a request.
const geocodeCache = new Map();

export const geocodeQuery = async (query) => {
  const q = String(query || "").trim();
  if (!q) return null;
  const direct = parseCoords(q);
  if (direct) return direct;
  if (geocodeCache.has(q)) return geocodeCache.get(q);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const coords = hit ? [parseFloat(hit.lat), parseFloat(hit.lon)] : null;
    if (coords) geocodeCache.set(q, coords);
    return coords;
  } catch {
    return null;
  }
};

// In-app embed of the keyless Google map. Used for the inline map preview.
export const eventMapEmbedUrl = (event) => {
  const q = eventMapQuery(event);
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
};

// In-app directions embed. `origin` is required by Google and is supplied as
// "lat,lng" from the visitor's location; `destination` accepts the event's
// address text directly. Uses the official Embed API when a key is configured,
// otherwise the keyless `output=embed` form (no key/billing needed).
export const eventDirectionsEmbedUrl = (event, origin) => {
  const destination = eventMapQuery(event);
  if (!destination || !origin) return null;
  if (mapsEmbedKeyPresent) {
    return (
      "https://www.google.com/maps/embed/v1/directions" +
      `?key=${encodeURIComponent(MAPS_EMBED_KEY)}` +
      `&origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}`
    );
  }
  return (
    "https://www.google.com/maps" +
    `?saddr=${encodeURIComponent(origin)}` +
    `&daddr=${encodeURIComponent(destination)}` +
    "&output=embed"
  );
};

// In-app Street View panorama. Needs a coordinate pair — the caller resolves
// the event address with geocodeQuery. Uses the official Embed API when a key
// is configured, otherwise the keyless `output=svembed` form. The keyless form
// only honors `cbll` when `cbp` (camera params) is present too — without it
// Google renders a world map — so `cbp` is required here. It is unofficial, so
// the modal keeps an "open in Google Maps" link as a backup.
export const eventStreetViewEmbedUrl = (coords) => {
  if (!coords) return null;
  const location = `${coords[0]},${coords[1]}`;
  if (mapsEmbedKeyPresent) {
    return (
      "https://www.google.com/maps/embed/v1/streetview" +
      `?key=${encodeURIComponent(MAPS_EMBED_KEY)}` +
      `&location=${location}` +
      "&heading=0&pitch=0&fov=90"
    );
  }
  return (
    "https://www.google.com/maps" +
    `?q=&layer=c&cbll=${location}` +
    "&cbp=11,0,0,0,0" +
    "&output=svembed"
  );
};

// Opens Google Maps directions to the event in a new tab. Used as the no-key
// fallback and as the "open in Google Maps" link inside the in-app modal.
export const eventDirectionsUrl = (event) => {
  const q = eventMapQuery(event);
  return q
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
    : null;
};

// Opens the ground-level ("3rd person") Street View of the event's surroundings
// in Google Maps. Uses a panorama viewpoint when we have coordinates, otherwise
// falls back to a place search the visitor can drop into Street View.
export const eventStreetViewUrl = (event) => {
  const q = eventMapQuery(event);
  if (!q) return null;
  const coords = parseCoords(q);
  if (coords) {
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords[0]},${coords[1]}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};
