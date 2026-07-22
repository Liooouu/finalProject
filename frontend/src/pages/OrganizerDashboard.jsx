import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

import OrganizerHome from "../components/organizer/OrgDashboardHome";
import OrgManageEvents from "../components/organizer/OrgManageEvents";
import ManageExcuses from "../components/organizer/ManageExcuses";
import NotificationsPage from "../components/organizer/NotificationsPage";
import ProfileSettings from "../components/settings/ProfileSettings";
import EventDetails from "../components/EventDetails";
import OrgManageAttendees from "../components/organizer/OrgManageAttendees";

const OrganizerDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      <Sidebar role="organizer" />
      <main className="flex-1 p-8 text-white overflow-auto">
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