import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { getUserFromToken, getLastActiveRole } from "./utils/auth";
import { ROLE_PATHS } from "./utils/nav";

import LandingPage from "./pages/LandingPage";
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
import ManageExcuses from "./components/organizer/ManageExcuses";

import ProfileSettings from "./components/settings/ProfileSettings";

// Pre-login front page. Anyone with a live token skips the marketing and
// lands on their own dashboard; a missing or expired token gets the landing.
// "/" itself has no role prefix, so we can't use the contextual token here —
// prefer the role the user was last actually working in (markRoleActive keeps
// that fresh), and only fall back to the generic token's role. Otherwise
// pasting the base URL randomly dumped people into the organizer dashboard
// whenever an organizer login happened to be the most recent one.
function LandingRoute() {
  const lastRole = getLastActiveRole();
  if (lastRole && ROLE_PATHS[lastRole]) {
    return <Navigate to={ROLE_PATHS[lastRole]} replace />;
  }
  const user = getUserFromToken();
  if (user?.role && ROLE_PATHS[user.role]) {
    return <Navigate to={ROLE_PATHS[user.role]} replace />;
  }
  return <LandingPage />;
}

function App() {
  return (
    <ThemeProvider>
    <Routes>
      <Route path="/" element={<LandingRoute />} />

        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/signup" element={<AuthPage />} />

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
          <Route path="*" element={<Navigate to="" replace />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["organizer"]} />}>
        <Route path="/organizer/dashboard/*" element={<OrganizerDashboard />}>
          <Route index element={<OrganizerHome />} />
          <Route path="events" element={<OrgManageEvents />} />
          <Route path="excuses" element={<ManageExcuses />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Route>
      </Route>
    </Routes>
    </ThemeProvider>
  );
}

export default App;