import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ChunkBoundary from "./components/shared/ChunkBoundary";
import TrackMark from "./components/shared/TrackMark";

// Route-level code splitting. Everything used to be one 1.37 MB bundle, so the
// landing page had to download chart.js and leaflet before it could paint. Each
// shell and public page now arrives on its first visit.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const OrganizerDashboard = lazy(() => import("./pages/OrganizerDashboard"));
const CheckInKiosk = lazy(() => import("./pages/CheckInKiosk"));

// The one chunk the shell itself can't draw without — a bare mark on the app
// background reads as "opening" instead of a blank flash.
const BootSplash = () => (
  <div className="flex min-h-screen items-center justify-center bg-[var(--app-base)]">
    <div className="flex flex-col items-center gap-3">
      <TrackMark className="h-10 w-10 animate-pulse text-brand" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-muted">
        Loading
      </p>
    </div>
  </div>
);

// Pre-login front page — always the landing, even with a live token. The URL
// you paste is the page you get; signed-in users reach their portal through
// the landing's Sign in / Get Started buttons (or by navigating directly).
function LandingRoute() {
  return <LandingPage />;
}

function App() {
  return (
    <ThemeProvider>
      <ChunkBoundary>
        <Suspense fallback={<BootSplash />}>
          <Routes>
            <Route path="/" element={<LandingRoute />} />

            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/signup" element={<AuthPage />} />

            {/* Public face check-in station. The 32-byte token in the URL is the
                only credential, and it is minted by an organizer for one event. */}
            <Route path="/check-in/:token" element={<CheckInKiosk />} />

            <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
              <Route path="/student/dashboard/*" element={<StudentDashboard />} />
            </Route>

            {/* The shells own their sub-routes (they render their own <Routes>,
                not an <Outlet>), so only the catch-all entry is needed here —
                their own "*" redirects unknown paths back to the index. */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["organizer"]} />}>
              <Route path="/organizer/dashboard/*" element={<OrganizerDashboard />} />
            </Route>
          </Routes>
        </Suspense>
      </ChunkBoundary>
    </ThemeProvider>
  );
}

export default App;
