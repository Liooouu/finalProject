import React, { Suspense, lazy, useEffect } from "react";
import "../styles/portal-workspace.css";
import "../styles/portal-neumorphism.css";
import "../styles/responsive-workspace.css";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/shared/AppBackground";
import RouteFallback from "../components/shared/RouteFallback";
import { PageMetaProvider } from "../context/PageMetaContext";
import { useScrollRestoration } from "../utils/useScrollRestoration";
import { prefetchIdle } from "../utils/prefetchRoutes";

// Per-page chunks; the event details and the attendee screens are only
// downloaded when they are opened.
const OrganizerHome = lazy(() => import("../components/organizer/OrgDashboardHome"));
const OrgManageEvents = lazy(() => import("../components/organizer/OrgManageEvents"));
const ManageExcuses = lazy(() => import("../components/organizer/ManageExcuses"));
const NotificationsPage = lazy(() => import("../components/organizer/NotificationsPage"));
const ProfileSettings = lazy(() => import("../components/settings/ProfileSettings"));
const EventDetails = lazy(() => import("../components/EventDetails"));
const ManualAttendance = lazy(() => import("../components/organizer/ManualAttendance"));
const ManualAttendanceReviews = lazy(() => import("../components/shared/ManualAttendanceReviews"));
const LegacyAttendanceRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/organizer/dashboard/manual-attendance/${id}`} replace />;
};

const OrganizerDashboard = () => {
  const scrollRef = useScrollRestoration();

  // Warm the pages this portal opens first while the browser is idle, so the
  // first tab switch has nothing left to download.
  useEffect(() => {
    prefetchIdle("organizer");
  }, []);

  return (
    <AppBackground className="portal-refined organizer-refined portal-neumorphic">
      <PageMetaProvider>
        <div className="relative flex h-dvh w-full overflow-hidden">
          <Sidebar role="organizer" />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Topbar />
            <main ref={scrollRef} className="flight-page min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 md:py-6 lg:px-8">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route index element={<OrganizerHome />} />
                  <Route path="events" element={<OrgManageEvents />} />
                  <Route path="events/:id" element={<EventDetails />} />
                  <Route path="events/:id/attendees" element={<LegacyAttendanceRedirect />} />
                  <Route path="manual-attendance" element={<ManualAttendance />} />
                  <Route path="manual-attendance/:id" element={<ManualAttendance />} />
                  <Route path="manual-reviews" element={<ManualAttendanceReviews />} />
                  <Route path="excuses" element={<ManageExcuses />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ProfileSettings />} />
                  <Route path="*" element={<Navigate to="/organizer/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default OrganizerDashboard;
