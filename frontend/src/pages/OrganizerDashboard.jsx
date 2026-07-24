import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { FaBars } from "react-icons/fa";
import Sidebar from "../components/Sidebar";

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
    <div className="flex min-h-screen bg-linear-to-br dark:from-red-950 dark:to-black from-slate-100 to-slate-200">
      <Sidebar role="organizer" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 text-on overflow-auto">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden mb-4 p-2 rounded-lg bg-card border border-line text-on hover:bg-card-alt transition-colors"
        >
          <FaBars className="text-lg" />
        </button>
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
  );
};

export default OrganizerDashboard;