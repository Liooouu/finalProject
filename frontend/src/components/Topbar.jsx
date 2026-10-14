import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaBars, FaMoon, FaSun, FaIdBadge, FaSignOutAlt, FaChevronDown } from "react-icons/fa";
import api from "../api/axios";
import { getUserFromToken, logout } from "../utils/auth";
import { portalName, profilePathFor, getPageTitle } from "../utils/nav";
import { useTheme } from "../context/ThemeContext";
import { usePageMeta } from "../context/PageMetaContext";
import NotificationBell from "./NotificationBell";
import ConfirmDialog from "./ui/ConfirmDialog";

const Topbar = ({ onOpenSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { meta } = usePageMeta();
  const user = getUserFromToken();
  const role = user?.role || getContextRoleFallback();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuRef = useRef(null);

  // The JWT only carries { id, role }, so the real name, email, and profile
  // picture are loaded from /account. Re-fetched on navigation so a picture
  // uploaded on the profile page shows up without a reload.
  const [account, setAccount] = useState(null);

  // Close the user dropdown when navigating to another route.
  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .get("/account")
      .then((res) => {
        if (alive) setAccount(res.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  const title = meta.title || getPageTitle(role, location.pathname);
  const subtitle = meta.subtitle || portalName[role] || "";

  // Initials come from the real name ("Lio Apiado" -> "LA"). Before the
  // account loads, fall back to the role's first letter instead of the old
  // ObjectId tail, which produced meaningless values like "93".
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

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-[var(--app-base)]/85 px-4 backdrop-blur-md md:px-6">
      {/* Mobile: open the sidebar drawer */}
      <button
        onClick={onOpenSidebar}
        aria-label="Open navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-on-dim hover:bg-card-alt hover:text-on md:hidden"
      >
        <FaBars className="text-sm" />
      </button>

      {/* Page title from the active page */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-tight text-on leading-tight">
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-xs text-on-dim">{subtitle}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <NotificationBell role={role} />

        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-on-dim hover:bg-card-alt hover:text-on"
        >
          {isDark ? <FaSun /> : <FaMoon className="text-sm" />}
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg border border-line py-1 pl-1 pr-2.5 hover:bg-card-alt"
          >
            {account?.profilePicture ? (
              <img
                src={account.profilePicture}
                alt=""
                className="h-7 w-7 rounded-md object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-[12px] font-bold text-white">
                {initials}
              </span>
            )}
            <span className="hidden text-sm font-medium text-on sm:block capitalize">
              {role}
            </span>
            <FaChevronDown className="hidden text-[10px] text-on-muted sm:block" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-line bg-card shadow-xl shadow-black/10 animate-fade-up"
            >
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-medium text-on">
                  {account?.name || `${role} account`}
                </p>
                <p className="truncate text-xs text-on-dim">
                  {account?.email || "Signed in"}
                </p>
              </div>
              <button
                role="menuitem"
                onClick={openProfile}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-on-dim hover:bg-card-alt hover:text-on"
              >
                <FaIdBadge /> My Profile
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmLogout(true);
                }}
                className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <FaSignOutAlt /> Log Out
              </button>
            </div>
          )}
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