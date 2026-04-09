import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import AuthPage from "./pages/auth/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";

// Protected route wrapper
import ProtectedRoute from "./components/ProtectedRoute";

// Shared components
import EventDetails from "./components/EventDetails";

// Admin pages
import DashboardHome from "./components/admin/DashboardHome";
import CreateOrganizer from "./components/admin/CreateOrganizerPage";

// Organizer pages
import OrganizerHome from "./components/organizer/OrgDashboardHome";
import OrgManageEvents from "./components/organizer/OrgManageEvents";
import OrgManageAttendees from "./components/organizer/OrgManageAttendees";
import AccountSettings from "./components/settings/AccountSettings";

function App() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/auth" />} />

      {/* Public route */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Student Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
        <Route path="/student/dashboard/*" element={<StudentDashboard />} />
      </Route>

      {/* Admin Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        {/* Parent dashboard route with nested pages */}
        <Route path="/admin/dashboard/*" element={<AdminDashboard />}>
          <Route index element={<DashboardHome />} />
          <Route path="create-organizer" element={<CreateOrganizer />} />
          <Route path="*" element={<Navigate to="" replace />} /> {/* fallback */}
        </Route>
      </Route>

      {/* Organizer Dashboard */}
      <Route element={<ProtectedRoute allowedRoles={["organizer"]} />}>
        <Route path="/organizer/dashboard/*" element={<OrganizerDashboard />}>
          <Route index element={<OrganizerHome />} />
          <Route path="events" element={<OrgManageEvents />} />
          <Route path="attendees" element={<OrgManageAttendees />} />
          <Route path="account-settings" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="" replace />} /> {/* fallback */}
        </Route>
      </Route>
    </Routes>
  );
}

export default App;