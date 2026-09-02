import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/shared/AppBackground";
import { PageMetaProvider } from "../context/PageMetaContext";

import DashboardHome from "../components/admin/DashboardHome";
import CreateOrganizerPage from "../components/admin/CreateOrganizerPage";
import ManageEvents from "../components/admin/ManageEvents";
import ManageUsers from "../components/admin/ManageUsers";
import AttendanceReport from "../components/admin/AttendanceReports";
import NotificationsPage from "../components/organizer/NotificationsPage";
import ProfileSettings from "../components/settings/ProfileSettings";
import EventDetails from "../components/EventDetails";
import OrgManageAttendees from "../components/organizer/OrgManageAttendees";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppBackground>
      <PageMetaProvider>
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              <Routes>
                <Route index element={<DashboardHome />} />
                <Route path="create-organizer" element={<CreateOrganizerPage />} />
                <Route path="events" element={<ManageEvents />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="events/:id/attendees" element={<OrgManageAttendees />} />
                <Route path="users" element={<ManageUsers />} />
                <Route path="reports" element={<AttendanceReport />} />
                <Route path="notifications" element={<NotificationsPage role="admin" />} />
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

export default AdminDashboard;