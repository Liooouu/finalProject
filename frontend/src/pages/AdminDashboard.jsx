import React, { Suspense, lazy, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MobileTabBar from "../components/mobile/MobileTabBar";
import MobileMenuSheet from "../components/mobile/MobileMenuSheet";
import AppBackground from "../components/shared/AppBackground";
import RouteFallback from "../components/shared/RouteFallback";
import { PageMetaProvider } from "../context/PageMetaContext";

// Per-page chunks: the chart-heavy dashboard, the leaflet event map and the
// reports table are only fetched when that page is actually opened.
const DashboardHome = lazy(() => import("../components/admin/DashboardHome"));
const CreateOrganizerPage = lazy(() => import("../components/admin/CreateOrganizerPage"));
const ManageEvents = lazy(() => import("../components/admin/ManageEvents"));
const ManageExcuses = lazy(() => import("../components/organizer/ManageExcuses"));
const ManageUsers = lazy(() => import("../components/admin/ManageUsers"));
const AttendanceReport = lazy(() => import("../components/admin/AttendanceReports"));
const NotificationsPage = lazy(() => import("../components/organizer/NotificationsPage"));
const ProfileSettings = lazy(() => import("../components/settings/ProfileSettings"));
const EventDetails = lazy(() => import("../components/EventDetails"));
const OrgManageAttendees = lazy(() => import("../components/organizer/OrgManageAttendees"));
const PinResetRequests = lazy(() => import("../components/security/PinResetRequests"));
const EmailSettings = lazy(() => import("../components/admin/EmailSettings"));

const AdminDashboard = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppBackground>
      <PageMetaProvider>
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="admin" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flight-page min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-6 md:py-6 lg:px-8">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route index element={<DashboardHome />} />
                  <Route path="create-organizer" element={<CreateOrganizerPage />} />
                  <Route path="events" element={<ManageEvents />} />
                  <Route path="events/:id" element={<EventDetails />} />
                  <Route path="events/:id/attendees" element={<OrgManageAttendees />} />
                  <Route path="excuses" element={<ManageExcuses />} />
                  <Route path="users" element={<ManageUsers />} />
                  <Route path="pin-resets" element={<PinResetRequests />} />
                  <Route path="reports" element={<AttendanceReport />} />
                  <Route path="settings/email" element={<EmailSettings />} />
                  <Route path="notifications" element={<NotificationsPage role="admin" />} />
                  <Route path="profile" element={<ProfileSettings />} />
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
            <MobileTabBar
              role="admin"
              menuOpen={menuOpen}
              onMore={() => setMenuOpen((open) => !open)}
            />
            <MobileMenuSheet
              role="admin"
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default AdminDashboard;