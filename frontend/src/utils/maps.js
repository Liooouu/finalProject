// Location text shared by the embed and the outbound links: the pinned
// `mapQuery` when the organizer set one, otherwise the plain location string.
const eventMapQuery = (event) =>
  event?.mapQuery?.trim() || event?.location?.trim() || "";

// "lat, lng" pair, if the pinned location is a coordinate string (the map
// picker accepts coordinates as well as addresses).
const parseCoords = (value) => {
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

export const eventMapEmbedUrl = (event) => {
  const q = eventMapQuery(event);
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
};

// Opens Google Maps directions to the event in a new tab.
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
