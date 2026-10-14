import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBolt,
  FaCalendarAlt,
  FaClock,
  FaCloud,
  FaCloudMoon,
  FaCloudRain,
  FaCloudSun,
  FaMoon,
  FaSmog,
  FaSnowflake,
  FaSun,
} from "react-icons/fa";

const DEFAULT_LAT = 14.5995;
const DEFAULT_LON = 120.9842;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Fixed decorative patterns for the sky scene — computed once at module load
// (never with Math.random in render, which the purity lint rule forbids).
const RAIN_DROPS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 47) % 100}%`,
  delay: `${(i * 0.17) % 1.4}s`,
  duration: `${0.7 + ((i * 13) % 7) / 10}s`,
}));

const SNOW_FLAKES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 61) % 100}%`,
  size: 3 + (i % 3) * 2,
  delay: `${(i * 0.43) % 3.2}s`,
  duration: `${3.5 + ((i * 17) % 20) / 10}s`,
}));

const STARS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 5) % 96}%`,
  top: `${(i * 53 + 8) % 70}%`,
  delay: `${(i * 0.31) % 2.4}s`,
  size: i % 4 === 0 ? 2 : 1,
}));

const EMPTY_WEATHER = {
  loaded: false,
  temp: null,
  feels: null,
  humidity: null,
  wind: null,
  precip: null,
  min: null,
  max: null,
  condition: "Weather unavailable",
  isDay: true,
  icon: FaSun,
  effect: null,
  heroClass: "from-indigo-500 to-slate-700",
  overlayClass: "from-indigo-500/[0.08] to-slate-500/[0.06]",
  sunrise: null,
  sunset: null,
  hours: [],
};

const metaForCode = (code, isDay) => {
  if (code === 0)
    return isDay
      ? { condition: "Clear", icon: FaSun, effect: "sun", heroClass: "from-amber-400 via-orange-500/80 to-sky-600", overlayClass: "from-amber-500/[0.12] to-sky-500/[0.08]" }
      : { condition: "Clear night", icon: FaMoon, effect: "moon", heroClass: "from-indigo-800 to-blue-950", overlayClass: "from-indigo-700/[0.14] to-blue-800/[0.1]" };
  if (code === 1 || code === 2)
    return isDay
      ? { condition: "Partly cloudy", icon: FaCloudSun, effect: "partly", heroClass: "from-sky-400 to-indigo-500", overlayClass: "from-sky-400/[0.1] to-indigo-500/[0.08]" }
      : { condition: "Partly cloudy", icon: FaCloudMoon, effect: "partly-night", heroClass: "from-indigo-700 to-slate-800", overlayClass: "from-indigo-600/[0.12] to-slate-600/[0.08]" };
  if (code === 3)
    return { condition: "Overcast", icon: FaCloud, effect: "cloud", heroClass: "from-slate-500 to-slate-700", overlayClass: "from-slate-500/[0.1] to-slate-600/[0.08]" };
  if (code === 45 || code === 48)
    return { condition: "Foggy", icon: FaSmog, effect: "fog", heroClass: "from-slate-400 to-slate-600", overlayClass: "from-slate-400/[0.12] to-slate-500/[0.08]" };
  if (code >= 51 && code <= 57)
    return { condition: "Drizzle", icon: FaCloudRain, effect: "rain", heroClass: "from-sky-600 to-slate-700", overlayClass: "from-sky-600/[0.1] to-slate-700/[0.08]" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { condition: "Rainy", icon: FaCloudRain, effect: "rain", heroClass: "from-blue-600 via-blue-800/80 to-slate-800", overlayClass: "from-blue-600/[0.12] to-slate-800/[0.08]" };
  if ((code >= 71 && code <= 77) || (code === 85 || code === 86))
    return { condition: "Snow", icon: FaSnowflake, effect: "snow", heroClass: "from-sky-200 to-blue-400", overlayClass: "from-sky-300/[0.14] to-blue-400/[0.08]" };
  if (code >= 95)
    return { condition: "Thunderstorm", icon: FaBolt, effect: "thunder", heroClass: "from-slate-700 via-indigo-800 to-slate-900", overlayClass: "from-indigo-700/[0.14] to-slate-800/[0.1]" };
  return null;
};

// Sky scene layered inside the weather hero — decorative only. Every layer is
// pointer-events-none and hidden from screen readers by the parent.
const WeatherScene = ({ effect }) => {
  if (effect === "rain" || effect === "thunder") {
    return (
      <>
        {effect === "thunder" && (
          <span className="wx-flash absolute inset-0 bg-white/70" />
        )}
        {RAIN_DROPS.map((d, i) => (
          <span
            key={i}
            className="wx-drop"
            style={{ left: d.left, animationDelay: d.delay, animationDuration: d.duration }}
          />
        ))}
      </>
    );
  }
  if (effect === "snow") {
    return (
      <>
        {SNOW_FLAKES.map((f, i) => (
          <span
            key={i}
            className="wx-flake rounded-full bg-white/90"
            style={{
              left: f.left,
              width: f.size,
              height: f.size,
              animationDelay: f.delay,
              animationDuration: f.duration,
            }}
          />
        ))}
      </>
    );
  }
  if (effect === "fog") {
    return (
      <>
        <span className="wx-fog absolute -left-1/4 top-1/3 h-6 w-1/2 rounded-full bg-white/25 blur-md" />
        <span
          className="wx-fog absolute left-1/3 top-2/3 h-5 w-2/3 rounded-full bg-white/20 blur-md"
          style={{ animationDuration: "9s" }}
        />
      </>
    );
  }
  if (effect === "sun" || effect === "partly") {
    return (
      <>
        <span className="wx-sun absolute -right-6 -top-8 h-24 w-24 rounded-full bg-amber-300/50 blur-xl" />
        {effect === "partly" && (
          <>
            <span
              className="wx-cloud absolute top-3 h-8 w-28 rounded-full bg-white/30 blur-md"
              style={{ animationDuration: "26s" }}
            />
            <span
              className="wx-cloud absolute top-10 h-7 w-24 rounded-full bg-white/25 blur-md"
              style={{ animationDuration: "38s", animationDelay: "-12s" }}
            />
          </>
        )}
      </>
    );
  }
  if (effect === "moon" || effect === "partly-night") {
    return (
      <>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="wx-star absolute rounded-full bg-white"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
            }}
          />
        ))}
        <span className="absolute -right-2 -top-4 h-16 w-16 rounded-full bg-slate-100/30 blur-md" />
        {effect === "partly-night" && (
          <span
            className="wx-cloud absolute top-8 h-7 w-28 rounded-full bg-white/15 blur-md"
            style={{ animationDuration: "34s" }}
          />
        )}
      </>
    );
  }
  if (effect === "cloud") {
    return (
      <>
        <span
          className="wx-cloud absolute top-3 h-8 w-32 rounded-full bg-white/25 blur-md"
          style={{ animationDuration: "30s" }}
        />
        <span
          className="wx-cloud absolute top-12 h-7 w-24 rounded-full bg-white/20 blur-md"
          style={{ animationDuration: "42s", animationDelay: "-15s" }}
        />
      </>
    );
  }
  return null;
};

const formatHourLabel = (iso) => {
  const h = parseInt(iso.slice(11, 13), 10);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12} ${ap}`;
};

const formatClock = (date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const TodayCard = ({
  events = [],
  selectedUpcoming = 0,
  onSelectEvent,
  quickActions = [],
}) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState(EMPTY_WEATHER);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let refreshId = null;

    const fetchWeather = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m` +
            `&hourly=temperature_2m,weather_code,is_day` +
            `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max` +
            `&timezone=auto&forecast_days=2`
        );
        const data = await res.json();
        if (cancelled || !data?.current) return;
        const meta = metaForCode(data.current.weather_code, data.current.is_day);

        // Next few hours, starting at the current one, for the mini strip.
        const times = data.hourly?.time || [];
        let idx = times.findIndex(
          (t) => t.slice(0, 13) === data.current.time?.slice(0, 13)
        );
        if (idx < 0) idx = 0;
        const hours = [];
        for (let i = idx; i < Math.min(idx + 5, times.length); i++) {
          const hMeta = metaForCode(
            data.hourly.weather_code[i],
            data.hourly.is_day[i]
          );
          hours.push({
            key: times[i],
            label: i === idx ? "Now" : formatHourLabel(times[i]),
            temp: Math.round(data.hourly.temperature_2m[i]),
            icon: (hMeta || meta).icon,
          });
        }

        const sunriseIso = data.daily?.sunrise?.[0];
        const sunsetIso = data.daily?.sunset?.[0];
        const sunrise = sunriseIso ? new Date(sunriseIso) : null;
        const sunset = sunsetIso ? new Date(sunsetIso) : null;

        setWeather({
          loaded: true,
          temp: Math.round(data.current.temperature_2m),
          feels: Math.round(data.current.apparent_temperature),
          humidity: data.current.relative_humidity_2m ?? null,
          wind: Math.round(data.current.wind_speed_10m),
          precip: data.daily?.precipitation_probability_max?.[0] ?? null,
          min: Math.round(data.daily.temperature_2m_min?.[0] ?? 0),
          max: Math.round(data.daily.temperature_2m_max?.[0] ?? 0),
          condition: meta.condition,
          isDay: data.current.is_day,
          icon: meta.icon,
          effect: meta.effect,
          heroClass: meta.heroClass,
          overlayClass: meta.overlayClass,
          sunrise,
          sunset,
          hours,
        });
      } catch {
        /* weather is decorative — fall back to neutral styling */
      }
    };

    const start = (lat, lon) => {
      fetchWeather(lat, lon);
      // Keep it fresh without hammering the API — 15 minutes is plenty for a
      // dashboard glance.
      refreshId = setInterval(() => fetchWeather(lat, lon), 15 * 60 * 1000);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) start(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          if (!cancelled) start(DEFAULT_LAT, DEFAULT_LON);
        },
        { timeout: 6000, maximumAge: 600000 }
      );
    } else {
      start(DEFAULT_LAT, DEFAULT_LON);
    }

    return () => {
      cancelled = true;
      if (refreshId) clearInterval(refreshId);
    };
  }, []);

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const firstWeekday = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const cells = useMemo(() => {
    const list = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    return list;
  }, [firstWeekday, daysInMonth]);

  const eventDayMap = useMemo(() => {
    const map = {};
    events.forEach((ev, idx) => {
      const d = new Date(ev.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = map[key] || [];
      map[key].push(idx);
    });
    return map;
  }, [events]);

  // Where the sun is on its arc right now (0 = sunrise, 1 = sunset). Ticks
  // live with the clock; null outside daylight or when data is missing.
  const dayProgress = (() => {
    if (!weather.sunrise || !weather.sunset) return null;
    const s = weather.sunrise.getTime();
    const e = weather.sunset.getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
    return Math.min(1, Math.max(0, (now.getTime() - s) / (e - s)));
  })();

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const monthTitle = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const WeatherIcon = weather.icon;

  return (
    <div className="relative overflow-hidden">
      <div
        className={`pointer-events-none absolute inset-0 bg-linear-to-br ${weather.overlayClass}`}
      />
      <div className="relative space-y-4">
        {/* Live clock + date */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-3xl font-bold text-on tabular-nums tracking-tight">{timeStr}</p>
            <p className="mt-0.5 text-sm text-on-dim truncate">{dateStr}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-400">
            <FaClock className="text-lg" />
          </span>
        </div>

        {/* Weather hero — gradient sky + animated scene + live details */}
        <div
          aria-hidden={weather.loaded ? undefined : "true"}
          className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${weather.heroClass} text-white shadow-lg shadow-black/10`}
        >
          <div className="pointer-events-none absolute inset-0">
            <WeatherScene effect={weather.effect} />
          </div>

          <div className="relative z-10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-4xl font-bold tabular-nums leading-none">
                  {weather.loaded ? `${weather.temp}°C` : "--"}
                </p>
                <p className="mt-1.5 text-sm font-medium opacity-90">{weather.condition}</p>
                {weather.loaded && (
                  <p className="mt-0.5 text-xs opacity-75">
                    Feels {weather.feels}° · H {weather.max}° L {weather.min}°
                  </p>
                )}
              </div>
              <WeatherIcon className="text-5xl opacity-95 drop-shadow-lg" />
            </div>

            {/* Quick stats */}
            {weather.loaded && (weather.humidity != null || weather.wind != null || weather.precip != null) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium opacity-85">
                {weather.humidity != null && <span>Humidity {weather.humidity}%</span>}
                {weather.wind != null && <span>Wind {weather.wind} km/h</span>}
                {weather.precip != null && <span>Rain {weather.precip}%</span>}
              </div>
            )}

            {/* Sun path — sunrise → sunset progress, ticks with the clock */}
            {weather.sunrise && weather.sunset && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] font-medium opacity-75">
                  <span>{formatClock(weather.sunrise)} sunrise</span>
                  <span>sunset {formatClock(weather.sunset)}</span>
                </div>
                <div className="relative mt-1 h-1.5 rounded-full bg-white/20">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-300/80 to-orange-400/80"
                    style={{ width: `${(dayProgress ?? 0) * 100}%` }}
                  />
                  {dayProgress !== null && (
                    <span
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                      style={{ left: `${dayProgress * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Next hours */}
            {weather.hours.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-1 rounded-xl bg-white/10 p-1.5 backdrop-blur-sm">
                {weather.hours.map((h) => {
                  const HIcon = h.icon;
                  return (
                    <div
                      key={h.key}
                      className="flex flex-col items-center gap-1 rounded-lg py-1.5"
                    >
                      <span className="text-[10px] font-medium opacity-75">{h.label}</span>
                      <HIcon className="text-base opacity-95" />
                      <span className="text-xs font-semibold tabular-nums">{h.temp}°</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Month calendar */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-on">{monthTitle}</p>
            <FaCalendarAlt className="text-on-muted text-sm" />
          </div>
          <div className="rounded-xl border border-line p-2">
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-medium uppercase text-on-muted py-1">
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`blank-${i}`} />;
                const key = `${now.getFullYear()}-${now.getMonth()}-${d}`;
                const isToday = key === todayKey;
                const evIdxs = eventDayMap[key];
                const isSelected = !!evIdxs?.includes(selectedUpcoming);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!evIdxs?.length}
                    onClick={() => onSelectEvent(evIdxs[0])}
                    className={`relative mx-auto flex h-9 w-full max-w-9 items-center justify-center rounded-lg text-sm transition-colors ${
                      isSelected
                        ? "bg-indigo-600 font-bold text-white shadow"
                        : isToday
                          ? "font-bold text-indigo-600 ring-2 ring-inset ring-indigo-500/60 dark:text-indigo-400"
                          : evIdxs?.length
                            ? "cursor-pointer text-on hover:bg-card-alt"
                            : "text-on-muted"
                    }`}
                  >
                    {d}
                    {evIdxs?.length && (
                      <span
                        className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                          isSelected ? "bg-white" : "bg-indigo-500"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-on-muted">
            Dots mark days with events — tap one to highlight it below.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-line pt-4">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors hover:-translate-y-0.5 ${a.color}`}
            >
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TodayCard;
