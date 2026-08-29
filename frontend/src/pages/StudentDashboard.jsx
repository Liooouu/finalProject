import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { FaBars } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";
import StarfieldBackground from "../components/shared/StarfieldBackground";

import DashboardHome from "../components/student/StDashboardHome";
import AttendEvents from "../components/student/AttendEvents";
import CommunityService from "../components/student/CommunityService";
import NotificationsPage from "../components/student/NotificationsPage";
import SubmitExcuse from "../components/student/SubmitExcuse";
import ProfileSettings from "../components/settings/ProfileSettings";
import EventDetails from "../components/EventDetails";

const StudentDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <StarfieldBackground isDark={isDark}>
      <div className="relative flex min-h-screen w-full">
        <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 overflow-auto">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden mb-4 p-2 rounded-lg bg-card border border-line text-on hover:bg-card-alt transition-colors"
          >
            <FaBars className="text-lg" />
          </button>
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
    </StarfieldBackground>
  );
};

export default StudentDashboard;