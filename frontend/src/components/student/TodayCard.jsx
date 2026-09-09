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

const EMPTY_WEATHER = {
  loaded: false,
  temp: null,
  min: null,
  max: null,
  condition: "Weather unavailable",
  isDay: true,
  icon: FaSun,
  heroClass: "from-indigo-500 to-slate-700",
  overlayClass: "from-indigo-500/[0.08] to-slate-500/[0.06]",
};

const metaForCode = (code, isDay) => {
  if (code === 0)
    return isDay
      ? { condition: "Clear", icon: FaSun, heroClass: "from-amber-400 via-orange-500/80 to-sky-600", overlayClass: "from-amber-500/[0.12] to-sky-500/[0.08]" }
      : { condition: "Clear night", icon: FaMoon, heroClass: "from-indigo-800 to-blue-950", overlayClass: "from-indigo-700/[0.14] to-blue-800/[0.1]" };
  if (code === 1 || code === 2)
    return isDay
      ? { condition: "Partly cloudy", icon: FaCloudSun, heroClass: "from-sky-400 to-indigo-500", overlayClass: "from-sky-400/[0.1] to-indigo-500/[0.08]" }
      : { condition: "Partly cloudy", icon: FaCloudMoon, heroClass: "from-indigo-700 to-slate-800", overlayClass: "from-indigo-600/[0.12] to-slate-600/[0.08]" };
  if (code === 3)
    return { condition: "Overcast", icon: FaCloud, heroClass: "from-slate-500 to-slate-700", overlayClass: "from-slate-500/[0.1] to-slate-600/[0.08]" };
  if (code === 45 || code === 48)
    return { condition: "Foggy", icon: FaSmog, heroClass: "from-slate-400 to-slate-600", overlayClass: "from-slate-400/[0.12] to-slate-500/[0.08]" };
  if (code >= 51 && code <= 57)
    return { condition: "Drizzle", icon: FaCloudRain, heroClass: "from-sky-600 to-slate-700", overlayClass: "from-sky-600/[0.1] to-slate-700/[0.08]" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { condition: "Rainy", icon: FaCloudRain, heroClass: "from-blue-600 via-blue-800/80 to-slate-800", overlayClass: "from-blue-600/[0.12] to-slate-800/[0.08]" };
  if ((code >= 71 && code <= 77) || (code === 85 || code === 86))
    return { condition: "Snow", icon: FaSnowflake, heroClass: "from-sky-200 to-blue-400", overlayClass: "from-sky-300/[0.14] to-blue-400/[0.08]" };
  if (code >= 95)
    return { condition: "Thunderstorm", icon: FaBolt, heroClass: "from-slate-700 via-indigo-800 to-slate-900", overlayClass: "from-indigo-700/[0.14] to-slate-800/[0.1]" };
  return null;
};

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
    const fetchWeather = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`
        );
        const data = await res.json();
        if (cancelled || !data?.current) return;
        const meta = metaForCode(data.current.weather_code, data.current.is_day);
        setWeather({
          loaded: true,
          temp: Math.round(data.current.temperature_2m),
          min: Math.round(data.daily.temperature_2m_min?.[0] ?? 0),
          max: Math.round(data.daily.temperature_2m_max?.[0] ?? 0),
          condition: meta.condition,
          isDay: data.current.is_day,
          icon: meta.icon,
          heroClass: meta.heroClass,
          overlayClass: meta.overlayClass,
        });
      } catch {
        /* weather is decorative — fall back to neutral styling */
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => fetchWeather(DEFAULT_LAT, DEFAULT_LON),
        { timeout: 6000, maximumAge: 600000 }
      );
    } else {
      fetchWeather(DEFAULT_LAT, DEFAULT_LON);
    }

    return () => {
      cancelled = true;
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

        {/* Weather hero */}
        <div
          className={`flex items-center justify-between rounded-xl bg-linear-to-br ${weather.heroClass} p-4 text-white shadow-lg shadow-black/10`}
        >
          <div>
            <p className="text-4xl font-bold tabular-nums">
              {weather.loaded ? `${weather.temp}°C` : "--"}
            </p>
            <p className="text-sm font-medium opacity-90">{weather.condition}</p>
            {weather.loaded && (
              <p className="mt-0.5 text-xs opacity-75">
                H {weather.max}°C · L {weather.min}°C
              </p>
            )}
          </div>
          <WeatherIcon className="text-5xl opacity-95 drop-shadow-lg" />
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