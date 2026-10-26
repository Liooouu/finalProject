import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaCheck } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MobileTabBar from "../components/mobile/MobileTabBar";
import MobileMenuSheet from "../components/mobile/MobileMenuSheet";
import AppBackground from "../components/shared/AppBackground";
import RouteFallback from "../components/shared/RouteFallback";
import { PageMetaProvider } from "../context/PageMetaContext";

// Each page is its own chunk, so opening the dashboard never downloads the
// event map (leaflet), the QR scanner or the settings forms up front.
const DashboardHome = lazy(() => import("../components/student/StDashboardHome"));
const AttendEvents = lazy(() => import("../components/student/AttendEvents"));
const CommunityService = lazy(() => import("../components/student/CommunityService"));
const NotificationsPage = lazy(() => import("../components/student/NotificationsPage"));
const SubmitExcuse = lazy(() => import("../components/student/SubmitExcuse"));
const ProfileSettings = lazy(() => import("../components/settings/ProfileSettings"));
const SecuritySettings = lazy(() => import("../components/settings/SecuritySettings"));
const EventDetails = lazy(() => import("../components/EventDetails"));

const StudentDashboard = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Toast passed in via navigation state (e.g. "Attendance successfully recorded!"
  // right after the organizer scans the student's QR). Auto-dismisses and clears
  // the location state so a page reload doesn't re-show it.
  const location = useLocation();
  const navigate = useNavigate();
  const toast = location.state?.trackedToast;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null });
    }, 3500);
    return () => clearTimeout(t);
  }, [toast, location.pathname, navigate]);

  return (
    <AppBackground>
      <PageMetaProvider>
        {toast && (
          <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-green-400 bg-green-600/95 px-5 py-4 text-white shadow-2xl backdrop-blur">
              <FaCheck className="text-2xl shrink-0" />
              <p className="font-bold">{toast}</p>
            </div>
          </div>
        )}
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="student" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flight-page min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-6 md:py-6 lg:px-8">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route index element={<DashboardHome />} />
                  <Route path="events" element={<AttendEvents />} />
                  <Route path="events/:id" element={<EventDetails />} />
                  <Route path="community-service" element={<CommunityService />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="submit-excuse" element={<SubmitExcuse />} />
                  <Route path="profile" element={<ProfileSettings />} />
                  <Route path="security" element={<SecuritySettings />} />
                  <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
            <MobileTabBar
              role="student"
              menuOpen={menuOpen}
              onMore={() => setMenuOpen((open) => !open)}
            />
            <MobileMenuSheet
              role="student"
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default StudentDashboard;