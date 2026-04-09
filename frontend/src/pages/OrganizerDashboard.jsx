import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

import OrganizerHome from "../components/organizer/OrgDashboardHome";
import OrgManageEvents from "../components/organizer/OrgManageEvents";
import ManageExcuses from "../components/organizer/ManageExcuses";
import NotificationsPage from "../components/organizer/NotificationsPage";
import OrganizerProfile from "../components/organizer/OrganizerProfile";
import AccountSettings from "../components/settings/AccountSettings";
import EventDetails from "../components/EventDetails";

const OrganizerDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      <Sidebar role="organizer" />
      <main className="flex-1 p-8 text-white overflow-auto">
        <Routes>
          <Route index element={<OrganizerHome />} />
          <Route path="events" element={<OrgManageEvents />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="excuses" element={<ManageExcuses />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<OrganizerProfile />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default OrganizerDashboard;