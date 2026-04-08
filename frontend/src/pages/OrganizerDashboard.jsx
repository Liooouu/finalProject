import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

import OrganizerHome from "../components/organizer/OrgDashboardHome";
import OrgManageEvents from "../components/organizer/OrgManageEvents";
import OrgManageAttendees from "../components/organizer/OrgManageAttendees";
import AccountSettings from "../components/settings/AccountSettings";

const OrganizerDashboard = () => {
  return (
    <div className="flex min-h-screen bg-linear-to-br from-red-950 to-black">
      <Sidebar role="organizer" />
      <main className="flex-1 p-8 text-white">
        <Routes>
          <Route index element={<OrganizerHome />} />
          <Route path="events" element={<OrgManageEvents />} />
          <Route path="attendees" element={<OrgManageAttendees />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default OrganizerDashboard;