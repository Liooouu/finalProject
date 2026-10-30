import React, { Suspense, lazy, useState, useEffect } from "react";
import "../styles/portal-workspace.css";
import "../styles/portal-neumorphism.css";
import "../styles/responsive-workspace.css";
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from "react-router-dom";
import { FaCheck, FaCamera } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/shared/AppBackground";
import RouteFallback from "../components/shared/RouteFallback";
import { PageMetaProvider } from "../context/PageMetaContext";
import api from "../api/axios";
import { useScrollRestoration } from "../utils/useScrollRestoration";
import { prefetchIdle } from "../utils/prefetchRoutes";

// Each page is its own chunk, so opening the dashboard never downloads the
// event details or the settings forms up front.
const DashboardHome = lazy(() => import("../components/student/StDashboardHome"));
const AttendEvents = lazy(() => import("../components/student/AttendEvents"));
const CommunityService = lazy(() => import("../components/student/CommunityService"));
const NotificationsPage = lazy(() => import("../components/student/NotificationsPage"));
const SubmitExcuse = lazy(() => import("../components/student/SubmitExcuse"));
const ProfileSettings = lazy(() => import("../components/settings/ProfileSettings"));
const EventDetails = lazy(() => import("../components/EventDetails"));

const StudentDashboard = () => {
  const scrollRef = useScrollRestoration();

  // Warm the pages this portal opens first while the browser is idle, so the
  // first tab switch has nothing left to download.
  useEffect(() => {
    prefetchIdle("student");
  }, []);

  // Toast passed in via navigation state (e.g. "Attendance successfully recorded!"
  // right after the face kiosk or an organizer marks the student). Auto-dismisses
  // and clears the location state so a page reload doesn't re-show it.
  const location = useLocation();
  const navigate = useNavigate();
  const toast = location.state?.trackedToast;

  // Attendance is face-only now, so a student with no enrolled face cannot be
  // checked in without an organizer doing it by hand. Nudge them to Settings.
  const [faceMissing, setFaceMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/account")
      .then(({ data }) => {
        if (!cancelled) setFaceMissing(!data?.faceEnrolledAt);
      })
      .catch(() => {
        // A failed profile fetch must not break the dashboard.
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null });
    }, 3500);
    return () => clearTimeout(t);
  }, [toast, location.pathname, navigate]);

  return (
    <AppBackground className="portal-refined student-refined portal-neumorphic">
      <PageMetaProvider>
        {toast && (
          <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-green-400 bg-green-600/95 px-5 py-4 text-white shadow-2xl backdrop-blur">
              <FaCheck className="text-2xl shrink-0" />
              <p className="font-bold">{toast}</p>
            </div>
          </div>
        )}
        <div className="relative flex h-dvh w-full overflow-hidden">
          <Sidebar role="student" />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Topbar />
            <main ref={scrollRef} className="flight-page min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:py-6 lg:px-8">
              {faceMissing && !(location.pathname === "/student/dashboard/profile" && new URLSearchParams(location.search).get("section") === "security") && (
                <div className="alert alert-warn mb-4" role="status">
                  <FaCamera className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-on">Enroll your face before your first event</p>
                    <p className="mt-0.5 text-sm">
                      Attendance is recorded by face at the organizer&apos;s check-in station. Until
                      you enroll, ask an organizer for a manual attendance request, which needs independent review.{" "}
                      <Link
                        to="/student/dashboard/profile?section=security"
                        className="font-semibold underline underline-offset-2"
                      >
                        Enroll now
                      </Link>
                    </p>
                  </div>
                </div>
              )}
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route index element={<DashboardHome />} />
                  <Route path="events" element={<AttendEvents />} />
                  <Route path="events/:id" element={<EventDetails />} />
                  <Route path="community-service" element={<CommunityService />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="submit-excuse" element={<SubmitExcuse />} />
                  <Route path="profile" element={<ProfileSettings />} />
                  <Route path="security" element={<Navigate to="/student/dashboard/profile?section=security" replace />} />
                  <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default StudentDashboard;
