import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaHome,
  FaUserPlus,
  FaCalendarAlt,
  FaUsers,
  FaChartBar,
  FaBell,
  FaEdit,
  FaClock,
  FaTimes,
} from "react-icons/fa";
import TrackMark from "./shared/TrackMark";
import { portalName } from "../utils/nav";

const menuItems = {
  admin: [
    { name: "Dashboard", path: "/admin/dashboard", icon: <FaHome /> },
    { name: "Create Organizer", path: "/admin/dashboard/create-organizer", icon: <FaUserPlus /> },
    { name: "Manage Events", path: "/admin/dashboard/events", icon: <FaCalendarAlt /> },
    { name: "Manage Users", path: "/admin/dashboard/users", icon: <FaUsers /> },
    { name: "Attendance Report", path: "/admin/dashboard/reports", icon: <FaChartBar /> },
    { name: "Notifications", path: "/admin/dashboard/notifications", icon: <FaBell /> },
  ],
  organizer: [
    { name: "Dashboard", path: "/organizer/dashboard", icon: <FaHome /> },
    { name: "Manage Events", path: "/organizer/dashboard/events", icon: <FaCalendarAlt /> },
    { name: "Manage Excuses", path: "/organizer/dashboard/excuses", icon: <FaEdit /> },
    { name: "Notifications", path: "/organizer/dashboard/notifications", icon: <FaBell /> },
  ],
  student: [
    { name: "Dashboard", path: "/student/dashboard", icon: <FaHome /> },
    { name: "Attend Events", path: "/student/dashboard/events", icon: <FaCalendarAlt /> },
    { name: "Community Service", path: "/student/dashboard/community-service", icon: <FaClock /> },
    { name: "Submit Excuse", path: "/student/dashboard/submit-excuse", icon: <FaEdit /> },
    { name: "Notifications", path: "/student/dashboard/notifications", icon: <FaBell /> },
  ],
};

const Sidebar = ({ role, isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const items = menuItems[role] || [];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isActive = (path) => {
    if (path === location.pathname) return true;
    // Treat a path as active when it's the dashboard and we're under it, or
    // when a dynamic detail route shares the same section path.
    if (path.endsWith("/events") && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-[var(--app-base)]/95 backdrop-blur-xl transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
            <TrackMark className="h-7 w-7" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-[17px] font-bold tracking-tight text-on">
              Track<span className="text-indigo-600">ED</span>
            </p>
            <p className="text-[11px] text-on-dim">{portalName[role]}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-dim hover:bg-card-alt hover:text-on md:hidden"
          >
            <FaTimes />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-on-muted">
            Menu
          </p>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = isActive(item.path);
              return (
                <li key={item.name}>
                  <button
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-300"
                        : "text-on-dim hover:bg-card-alt hover:text-on"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                    <span className={`text-base ${active ? "text-indigo-600 dark:text-indigo-400" : "text-on-muted"}`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-line px-5 py-4">
          <p className="text-[11px] text-on-muted">
            University Event Attendance
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;