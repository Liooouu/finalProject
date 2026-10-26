import React, { Suspense, lazy, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import MobileTabBar from "../components/mobile/MobileTabBar";
import MobileMenuSheet from "../components/mobile/MobileMenuSheet";
import AppBackground from "../components/shared/AppBackground";
import RouteFallback from "../components/shared/RouteFallback";
import { PageMetaProvider } from "../context/PageMetaContext";

// Per-page chunks; the event map (leaflet) and the attendee screens are only
// downloaded when they are opened.
const OrganizerHome = lazy(() => import("../components/organizer/OrgDashboardHome"));
const OrgManageEvents = lazy(() => import("../components/organizer/OrgManageEvents"));
const ManageExcuses = lazy(() => import("../components/organizer/ManageExcuses"));
const NotificationsPage = lazy(() => import("../components/organizer/NotificationsPage"));
const ProfileSettings = lazy(() => import("../components/settings/ProfileSettings"));
const EventDetails = lazy(() => import("../components/EventDetails"));
const OrgManageAttendees = lazy(() => import("../components/organizer/OrgManageAttendees"));
const PinResetRequests = lazy(() => import("../components/security/PinResetRequests"));

const OrganizerDashboard = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppBackground>
      <PageMetaProvider>
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="organizer" />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flight-page min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 md:px-6 md:py-6 lg:px-8">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route index element={<OrganizerHome />} />
                  <Route path="events" element={<OrgManageEvents />} />
                  <Route path="events/:id" element={<EventDetails />} />
                  <Route path="events/:id/attendees" element={<OrgManageAttendees />} />
                  <Route path="excuses" element={<ManageExcuses />} />
                  <Route path="pin-resets" element={<PinResetRequests />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="profile" element={<ProfileSettings />} />
                  <Route path="*" element={<Navigate to="/organizer/dashboard" replace />} />
                </Routes>
              </Suspense>
            </main>
            <MobileTabBar
              role="organizer"
              menuOpen={menuOpen}
              onMore={() => setMenuOpen((open) => !open)}
            />
            <MobileMenuSheet
              role="organizer"
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default OrganizerDashboard;