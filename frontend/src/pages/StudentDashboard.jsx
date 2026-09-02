import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/shared/AppBackground";
import { PageMetaProvider } from "../context/PageMetaContext";

import DashboardHome from "../components/student/StDashboardHome";
import AttendEvents from "../components/student/AttendEvents";
import CommunityService from "../components/student/CommunityService";
import NotificationsPage from "../components/student/NotificationsPage";
import SubmitExcuse from "../components/student/SubmitExcuse";
import ProfileSettings from "../components/settings/ProfileSettings";
import EventDetails from "../components/EventDetails";

const StudentDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppBackground>
      <PageMetaProvider>
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              <Routes>
                <Route index element={<DashboardHome />} />
                <Route path="events" element={<AttendEvents />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="community-service" element={<CommunityService />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="submit-excuse" element={<SubmitExcuse />} />
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

export default StudentDashboard;