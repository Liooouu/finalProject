import React, { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { FaSearch } from "react-icons/fa";

const PH_CENTER = [12.8797, 121.774];
const PH_ZOOM = 6;
const PIN_ZOOM = 16;

const parseLatLng = (value) => {
  if (!value) return null;
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

const MapPicker = ({ value, onChange, className = "h-72" }) => {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const queryTimer = useRef(null);
  const blurTimer = useRef(null);
  const initialValueRef = useRef(value);
  onChangeRef.current = onChange;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const resolveAddress = useCallback(async (latlng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${latlng.lat}&lon=${latlng.lng}`
      );
      const data = await res.json();
      const name = data?.display_name || `${latlng.lat}, ${latlng.lng}`;
      setQuery(name);
      onChangeRef.current(name);
    } catch {
      const name = `${latlng.lat}, ${latlng.lng}`;
      setQuery(name);
      onChangeRef.current(name);
    }
  }, []);

  const moveTo = useCallback(
    (latlng) => {
      const map = mapRef.current;
      if (!map) return;
      map.setView(latlng, Math.max(map.getZoom(), PIN_ZOOM));
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng, { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (e) => resolveAddress(e.target.getLatLng()));
      } else {
        markerRef.current.setLatLng(latlng);
      }
    },
    [resolveAddress]
  );

  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl,
      iconRetinaUrl,
      shadowUrl,
    });

    const map = L.map(mapEl.current, {
      scrollWheelZoom: false,
    }).setView(PH_CENTER, PH_ZOOM);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    map.on("click", (e) => {
      moveTo(e.latlng);
      resolveAddress(e.latlng);
    });

    const existing = parseLatLng(initialValueRef.current);
    if (existing) moveTo(L.latLng(existing[0], existing[1]));

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [moveTo, resolveAddress]);

  useEffect(
    () => () => {
      clearTimeout(queryTimer.current);
      clearTimeout(blurTimer.current);
    },
    []
  );

  const searchAddress = async (q) => {
    if (!q || q.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => searchAddress(q), 400);
  };

  const selectPlace = (place) => {
    setResults([]);
    setQuery(place.display_name);
    moveTo(L.latLng(parseFloat(place.lat), parseFloat(place.lon)));
    onChangeRef.current(place.display_name);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      selectPlace(results[0]);
    }
  };

  const handleBlur = () => {
    clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setResults([]), 200);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <FaSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-on-muted" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Search address, place, or coordinates"
          className="w-full bg-card border border-line rounded-lg pl-9 pr-3.5 py-2.5 text-on placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-muted">
            Searching...
          </span>
        )}
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-56 overflow-auto rounded-lg border border-line bg-card shadow-lg shadow-indigo-900/10">
            {results.map((place, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={() => selectPlace(place)}
                  className="w-full px-3.5 py-2.5 text-left text-sm text-on-dim transition-colors hover:bg-card-alt hover:text-on"
                >
                  {place.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        ref={mapEl}
        className={`relative z-0 w-full overflow-hidden rounded-xl border border-line ${className}`}
      />
      <p className="text-xs text-on-muted">
        Click the map to drop a pin, or search above — the location will be filled in automatically.
      </p>
    </div>
  );
};

export default MapPicker;