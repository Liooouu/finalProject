import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FaCheck } from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/shared/AppBackground";
import { PageMetaProvider } from "../context/PageMetaContext";

import DashboardHome from "../components/student/StDashboardHome";
import AttendEvents from "../components/student/AttendEvents";
import CommunityService from "../components/student/CommunityService";
import NotificationsPage from "../components/student/NotificationsPage";
import SubmitExcuse from "../components/student/SubmitExcuse";
import ProfileSettings from "../components/settings/ProfileSettings";
import SecuritySettings from "../components/settings/SecuritySettings";
import EventDetails from "../components/EventDetails";

const StudentDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toast passed in via navigation state (e.g. "Attendance successfully recorded!"
  // right after the organizer scans the student's QR). Auto-dismisses and clears
  // the location state so a page reload doesn't re-show it.
  const location = useLocation();
  const navigate = useNavigate();
  const toast = location.state?.trackedToast;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null });
    }, 3500);
    return () => clearTimeout(t);
  }, [toast, location.pathname, navigate]);

  return (
    <AppBackground>
      <PageMetaProvider>
        {toast && (
          <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-green-400 bg-green-600/95 px-5 py-4 text-white shadow-2xl backdrop-blur">
              <FaCheck className="text-2xl shrink-0" />
              <p className="font-bold">{toast}</p>
            </div>
          </div>
        )}
        <div className="relative flex h-screen w-full overflow-hidden">
          <Sidebar role="student" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8">
              <Routes>
                <Route index element={<DashboardHome />} />
                <Route path="events" element={<AttendEvents />} />
                <Route path="events/:id" element={<EventDetails />} />
                <Route path="community-service" element={<CommunityService />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="submit-excuse" element={<SubmitExcuse />} />
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="*" element={<Navigate to="" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </PageMetaProvider>
    </AppBackground>
  );
};

export default StudentDashboard;