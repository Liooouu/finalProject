import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { FaBars } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import { useTheme } from "../context/ThemeContext";
import StarfieldBackground from "../components/shared/StarfieldBackground";

import DashboardHome from "../components/admin/DashboardHome";
import CreateOrganizerPage from "../components/admin/CreateOrganizerPage";
import ManageEvents from "../components/admin/ManageEvents";
import ManageUsers from "../components/admin/ManageUsers";
import AttendanceReport from "../components/admin/AttendanceReports";
import NotificationsPage from "../components/organizer/NotificationsPage";
import ProfileSettings from "../components/settings/ProfileSettings";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <StarfieldBackground isDark={isDark}>
      <div className="relative flex min-h-screen w-full">
        <Sidebar role="admin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 overflow-auto">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden mb-4 p-2 rounded-lg bg-card border border-line text-on hover:bg-card-alt transition-colors"
          >
            <FaBars className="text-lg" />
          </button>
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="create-organizer" element={<CreateOrganizerPage />} />
            <Route path="events" element={<ManageEvents />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="notifications" element={<NotificationsPage role="admin" />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </main>
      </div>
    </StarfieldBackground>
  );
};

export default AdminDashboard;