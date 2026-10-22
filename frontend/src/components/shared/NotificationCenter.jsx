import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  FaBell,
  FaBolt,
  FaCalendarAlt,
  FaCheck,
  FaEdit,
  FaExclamationTriangle,
  FaInfo,
  FaTrash,
  FaChevronRight,
} from "react-icons/fa";
import Loading from "./Loading";
import EmptyState from "./EmptyState";
import { usePageMeta } from "../../context/PageMetaContext";
import {
  Button,
  Card,
  PageHeader,
  SegmentedControl,
} from "../ui";
import ConfirmDialog from "../ui/ConfirmDialog";
import { formatDate, notifyNotificationsChanged } from "../../utils/helpers";
import { useAutoRefresh } from "../../utils/useAutoRefresh";

const TYPE_CONFIG = {
  attendance: {
    icon: <FaCalendarAlt />,
    chip: "bg-info/10 text-info ring-info/20",
    label: "Attendance",
  },
  excuse: {
    icon: <FaEdit />,
    chip: "bg-warn/10 text-warn ring-warn/20",
    label: "Excuse",
  },
  penalty: {
    icon: <FaExclamationTriangle />,
    chip: "bg-danger/10 text-danger ring-danger/20",
    label: "Penalty",
  },
  system: {
    icon: <FaBolt />,
    chip: "bg-brand/10 text-brand ring-brand/20",
    label: "System",
  },
  info: {
    icon: <FaInfo />,
    chip: "bg-card-alt text-on-muted ring-line",
    label: "Info",
  },
};

const relativeTime = (value) => {
  const now = new Date();
  const then = new Date(value);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "Just now";
  const minutes = Math.floor(diff / 60);
  if (diff < 3600) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(diff / 3600);
  if (diff < 86400) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(diff / 86400);
  if (diff < 604800) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(then);
};

/**
 * Resolve where a notification should take the reader. Event-bound updates go
 * straight to that event; account and review alerts go to the page where the
 * reader can act on them.
 */
const targetForNotification = (notif, role) => {
  const text = `${notif.title || ""} ${notif.message || ""}`.toLowerCase();
  const eventId = notif.relatedEvent?._id || notif.relatedEvent;
  const eventTarget = eventId ? `/${role}/dashboard/events/${eventId}` : null;

  if (role === "student") {
    if (/face verification|security pin|pin reset/.test(text)) {
      return "/student/dashboard/security";
    }
    if (/excuse/.test(text)) {
      return "/student/dashboard/submit-excuse";
    }
    if (/community service/.test(text)) {
      return "/student/dashboard/community-service";
    }
    return eventTarget || "/student/dashboard/events";
  }

  if (role === "admin") {
    if (/pin reset/.test(text)) return "/admin/dashboard/pin-resets";
    if (/face verification appeal|impersonation|security pin|face verification/.test(text)) {
      return "/admin/dashboard/users";
    }
    if (/excuse/.test(text)) return "/admin/dashboard/excuses";
    return eventTarget || "/admin/dashboard/events";
  }

  if (/pin reset/.test(text)) return "/organizer/dashboard/pin-resets";
  if (/excuse/.test(text)) return "/organizer/dashboard/excuses";
  return eventTarget || "/organizer/dashboard/events";
};

/**
 * NotificationCenter �?" the shared inbox for students, organizers and admins.
 * Quick actions are supplied per role so the page keeps pointing at the right
 * dashboard routes.
 */
const NotificationCenter = ({ actions = [], role = "student" }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [filter, setFilter] = useState("all");

  usePageMeta("Notifications", "Stay updated with your events.");

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useAutoRefresh(fetchNotifications);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      notifyNotificationsChanged();
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const openNotification = (notif) => {
    if (!notif.isRead) markAsRead(notif._id);
    const target = targetForNotification(notif, role);
    if (target) navigate(target);
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      notifyNotificationsChanged();
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      notifyNotificationsChanged();
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const deleteAllNotifications = async () => {
    if (deletingAll) return;
    setDeletingAll(true);
    try {
      await api.delete("/notifications");
      setNotifications([]);
      notifyNotificationsChanged();
      setConfirmDeleteAll(false);
    } catch (err) {
      console.error(err.response?.data || err.message);
    } finally {
      setDeletingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, filter]
  );

  if (loading) {
    return <Loading label="Loading notifications..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"} waiting for you.`
            : "You're all caught up."
        }
        actions={
          notifications.length > 0 && (
            <>
              <SegmentedControl
                ariaLabel="Filter notifications"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: notifications.length },
                  { value: "unread", label: "Unread", count: unreadCount },
                ]}
              />
              {unreadCount > 0 && (
                <Button variant="secondary" size="sm" onClick={markAllAsRead}>
                  <FaCheck className="text-[11px]" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDeleteAll(true)}
              >
                <FaTrash className="text-[11px]" />
                Delete all
              </Button>
            </>
          )
        }
      />

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FaBell />}
            title="No notifications yet"
            description="Updates about attendance, excuses and events will appear here."
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FaCheck />}
            title="No unread notifications"
            description="Everything here has been read."
            action={
              <Button variant="secondary" size="sm" onClick={() => setFilter("all")}>
                View all
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
            return (
              <li key={notif._id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openNotification(notif)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNotification(notif);
                    }
                  }}
                  className="panel-surface group flex cursor-pointer items-start gap-3 rounded-[var(--panel-radius)] p-4 transition-all duration-150 hover:border-brand/25 sm:gap-4 sm:p-5"
                  style={
                    notif.isRead
                      ? undefined
                      : {
                          borderColor:
                            "color-mix(in srgb, var(--brand) 36%, transparent)",
                        }
                  }
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm ring-1 ring-inset ${config.chip}`}
                  >
                    {config.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-on">{notif.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${config.chip}`}
                      >
                        {config.label}
                      </span>
                      {!notif.isRead && (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand ring-1 ring-inset ring-brand/20">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-on-dim">
                      {notif.message}
                    </p>
                    <p className="mt-2 text-[11px] text-on-muted">
                      {relativeTime(notif.createdAt)}
                    </p>
                  </div>

                  <FaChevronRight
                    className="mt-1 shrink-0 text-[10px] text-on-muted transition-colors group-hover:text-brand"
                    aria-hidden="true"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(notif._id);
                    }}
                    className="shrink-0 rounded-lg p-2 text-on-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Delete notification"
                  >
                    <FaTrash className="text-xs" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {actions.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-xs text-brand ring-1 ring-inset ring-brand/20">
              <FaBolt />
            </span>
            <h3 className="panel-heading text-base">Quick actions</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.to)}
                className="group flex items-center gap-3 rounded-xl border border-line bg-card-alt/30 p-4 text-left transition-colors hover:border-brand/25 hover:bg-card-alt/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm text-brand ring-1 ring-inset ring-brand/20">
                  {action.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-on transition-colors group-hover:text-brand">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-on-muted">
                    {action.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete notification?"
        message="This notification will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          deleteNotification(target);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={confirmDeleteAll}
        title="Delete all notifications?"
        message={`This permanently removes all ${notifications.length} notification${
          notifications.length === 1 ? "" : "s"
        }. This action cannot be undone.`}
        confirmLabel="Delete all"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={deleteAllNotifications}
        onCancel={() => setConfirmDeleteAll(false)}
        busy={deletingAll}
      />
    </div>
  );
};

export default NotificationCenter;
