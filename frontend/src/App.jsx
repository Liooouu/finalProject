import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AuthPage from "./pages/auth/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";

import ProtectedRoute from "./components/ProtectedRoute";

import EventDetails from "./components/EventDetails";

import DashboardHome from "./components/admin/DashboardHome";
import CreateOrganizer from "./components/admin/CreateOrganizerPage";
import ManageUsers from "./components/admin/ManageUsers";
import ManageEvents from "./components/admin/ManageEvents";
import AttendanceReports from "./components/admin/AttendanceReports";

import OrganizerHome from "./components/organizer/OrgDashboardHome";
import OrgManageEvents from "./components/organizer/OrgManageEvents";
import OrgManageAttendees from "./components/organizer/OrgManageAttendees";
import ManageExcuses from "./components/organizer/ManageExcuses";

import ProfileSettings from "./components/settings/ProfileSettings";
import AccountSettings from "./components/settings/AccountSettings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth" />} />

      <Route path="/auth" element={<AuthPage />} />

      <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
        <Route path="/student/dashboard/*" element={<StudentDashboard />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin/dashboard/*" element={<AdminDashboard />}>
          <Route index element={<DashboardHome />} />
          <Route path="create-organizer" element={<CreateOrganizer />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="events" element={<ManageEvents />} />
          <Route path="reports" element={<AttendanceReports />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["organizer"]} />}>
        <Route path="/organizer/dashboard/*" element={<OrganizerDashboard />}>
          <Route index element={<OrganizerHome />} />
          <Route path="events" element={<OrgManageEvents />} />
          <Route path="attendees" element={<OrgManageAttendees />} />
          <Route path="excuses" element={<ManageExcuses />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;