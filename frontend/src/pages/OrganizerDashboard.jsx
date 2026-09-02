import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/shared/AppBackground";
import { PageMetaProvider } from "../context/PageMetaContext";

import OrganizerHome from "../components/organizer/OrgDashboardHome";
import OrgManageEvents from "../components/organizer/OrgManageEvents";
import ManageExcuses from "../components/organizer/ManageExcuses";
import NotificationsPage from "../components/organizer/NotificationsPage";
import ProfileSettings from "../components/settings/ProfileSettings";
import EventDetails from "../components/EventDetails";
import OrgManageAttendees from "../components/organizer/OrgManageAttendees";

const OrganizerDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppBackground>
      <PageMetaProvider>
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="organizer" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              <Routes>
                <Route index element={<OrganizerHome />} />
                <Route path="events" element={<OrgManageEvents />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="events/:id/attendees" element={<OrgManageAttendees />} />
                <Route path="excuses" element={<ManageExcuses />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="*" element={<Navigate to="" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default OrganizerDashboard;