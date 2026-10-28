import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaMoon,
  FaSun,
  FaIdBadge,
  FaSignOutAlt,
  FaChevronDown,
  FaSearch,
  FaExchangeAlt,
} from "react-icons/fa";
import api from "../api/axios";
import { getUserFromToken, logout, setAuth } from "../utils/auth";
import { profilePathFor, getPageTitle } from "../utils/nav";
import { breadcrumbTrail, flatNavItems } from "../utils/navItems";
import { subscribeToDataChanges } from "../utils/dataSync";
import { useTheme } from "../context/ThemeContext";
import { usePageMeta } from "../context/PageMetaContext";
import NotificationBell from "./NotificationBell";
import ConfirmDialog from "./ui/ConfirmDialog";
import Breadcrumbs from "./ui/Breadcrumbs";
import CommandPalette from "./ui/CommandPalette";

const Topbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { meta } = usePageMeta();
  const user = getUserFromToken();
  const role = user?.role || getContextRoleFallback();

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [account, setAccount] = useState(null);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const menuRef = useRef(null);

  // Close the user dropdown when navigating to another route.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The JWT only carries { id, role }, so the real name, email, and profile
  // picture are loaded from /account. It used to refetch on every navigation,
  // which added a request to every page tap without ever showing new data; it
  // now loads once and refreshes when something actually changes (profile
  // update anywhere in the app) or when the tab regains focus.
  useEffect(() => {
    let alive = true;

    const load = () => {
      api
        .get("/account")
        .then((res) => {
          if (alive) setAccount(res.data);
        })
        .catch(() => {});
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };

    load();
    const unsubscribe = subscribeToDataChanges(load);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const title = meta.title || getPageTitle(role, location.pathname);
  const subtitle = meta.subtitle || "";
  const paletteItems = useMemo(() => flatNavItems(role), [role]);

  const trail = useMemo(() => {
    const base = breadcrumbTrail(role, location.pathname);
    const last = base[base.length - 1];
    return last && last.label === title ? base : [...base, { label: title }];
  }, [role, location.pathname, title]);

  const initials = account?.name
    ? String(account.name)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "U"
    : (role?.[0] || "U").toUpperCase();

  const openProfile = () => {
    setMenuOpen(false);
    navigate(profilePathFor[role] || "/");
  };

  const switchPortal = async targetRole => {
    if (switchingRole) return;
    setSwitchingRole(true); setSwitchError("");
    try {
      const { data } = await api.post("/auth/switch-role", { role: targetRole });
      setAuth(data.token, data.role);
      window.location.assign(`/${data.role}/dashboard`);
    } catch (error) {
      setSwitchError(error.response?.data?.message || "Could not switch portals. Please try again.");
      setSwitchingRole(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[var(--app-base)]/95">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 md:px-6">
        {/* Breadcrumb + page title */}
        <div className="min-w-0 flex-1">
          <Breadcrumbs items={trail} />
          <div className="mt-0.5 flex items-baseline gap-2">
            <h1 className="truncate font-display text-[15px] font-semibold tracking-tight text-on">
              {title}
            </h1>
            {subtitle && (
              <span className="hidden max-w-[280px] truncate text-xs text-on-muted lg:inline">
                · {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-on-muted transition-colors hover:border-brand/30 hover:text-on sm:inline-flex"
            aria-label="Open command menu"
          >
            <FaSearch className="text-[11px]" />
            <span>Search</span>
            <kbd className="ml-1 rounded border border-line bg-card-alt px-1.5 py-0.5 text-[10px] font-medium">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search pages"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card/60 text-on-dim transition-colors hover:bg-card-alt hover:text-on sm:hidden"
          >
            <FaSearch className="text-sm" />
          </button>

          <NotificationBell role={role} />

          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card/60 text-on-dim transition-colors hover:bg-card-alt hover:text-on sm:h-9 sm:w-9"
          >
            {isDark ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
          </button>

          <span className="mx-0.5 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-xl border border-line bg-card/60 py-1.5 pl-1 pr-2 transition-colors hover:border-brand/30 sm:py-1"
            >
              {account?.profilePicture ? (
                <img
                  src={account.profilePicture}
                  alt=""
                  className="h-7 w-7 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-[11px] font-bold text-white">
                  {initials}
                </span>
              )}
              <span className="hidden max-w-[120px] truncate text-left md:block">
                <span className="block truncate text-[12px] font-semibold leading-tight text-on">
                  {account?.name || `${role} account`}
                </span>
                <span className="block text-[10px] capitalize leading-tight text-on-muted">
                  {role}
                </span>
              </span>
              <FaChevronDown className="hidden text-[9px] text-on-muted sm:block" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="animate-fade-up absolute right-0 top-12 w-60 overflow-hidden rounded-[var(--panel-radius)] border border-line bg-[var(--panel-bg)] p-1.5 shadow-[var(--elev-3)]"
              >
                <div className="flex items-center gap-3 rounded-xl bg-card-alt/60 px-3 py-3">
                  {account?.profilePicture ? (
                    <img
                      src={account.profilePicture}
                      alt=""
                      className="h-9 w-9 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-[12px] font-bold text-white">
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on">
                      {account?.name || `${role} account`}
                    </p>
                    <p className="truncate text-[11px] text-on-muted">
                      {account?.email || "Signed in"}
                    </p>
                  </div>
                </div>

                {(account?.availableRoles || []).filter(target => target !== role && ["student", "organizer"].includes(target)).map(target => <button key={target} role="menuitem" disabled={switchingRole} onClick={() => switchPortal(target)} className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-brand hover:bg-brand/10 disabled:opacity-50"><FaExchangeAlt className="shrink-0 text-xs" />{switchingRole ? "Switching portal…" : `Switch to ${target} portal`}</button>)}
                {switchError && <p role="alert" className="px-3 py-2 text-xs text-danger">{switchError}</p>}
                <button
                  role="menuitem"
                  onClick={openProfile}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-on-dim transition-colors hover:bg-card-alt hover:text-on"
                >
                  <FaIdBadge className="text-xs" /> My Profile
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmLogout(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  <FaSignOutAlt className="text-xs" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Log out of TrackED?"
        message="You will need to sign back in to continue tracking attendance."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={paletteItems}
      />
    </header>
  );
};

const getContextRoleFallback = () => {
  const p = window.location.pathname;
  if (p.startsWith("/student")) return "student";
  if (p.startsWith("/organizer")) return "organizer";
  if (p.startsWith("/admin")) return "admin";
  return "student";
};

export default Topbar;
