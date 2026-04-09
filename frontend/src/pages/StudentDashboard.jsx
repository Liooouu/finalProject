import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

import DashboardHome from "../components/student/StDashboardHome";
import AttendEvents from "../components/student/AttendEvents";
import AccountSettings from "../components/settings/AccountSettings";
import EventDetails from "../components/EventDetails";

const StudentDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      <Sidebar role="student" />
      <main className="flex-1 p-8 text-white">
        <Routes>
          <Route index element={<DashboardHome />} />
          <Route path="events" element={<AttendEvents />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default StudentDashboard;