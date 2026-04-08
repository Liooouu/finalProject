import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

import DashboardHome from "../components/admin/DashboardHome";
import CreateOrganizerPage from "../components/admin/CreateOrganizerPage";
import ManageEvents from "../components/admin/ManageEvents";
import ManageUsers from "../components/admin/ManageUsers";
import AttendanceReport from "../components/admin/AttendanceReports";
import AccountSettings from "../components/settings/AccountSettings";

const AdminDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      <Sidebar role="admin" />
      <main className="flex-1 p-8 text-white">
        <Routes>
          <Route index element={<DashboardHome />} />
          <Route path="create-organizer" element={<CreateOrganizerPage />} />
          <Route path="events" element={<ManageEvents />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="reports" element={<AttendanceReport />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;