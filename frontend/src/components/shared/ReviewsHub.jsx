import React, { lazy, Suspense } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { getContextRole } from "../../utils/auth";
import { useNavCounts } from "../../utils/navCounts";
import { PageHeader, Tabs } from "../ui";
import RouteFallback from "./RouteFallback";

const ManualAttendanceReviews = lazy(() => import("./ManualAttendanceReviews"));
const ManageExcuses = lazy(() => import("../organizer/ManageExcuses"));
const FaceAppeals = lazy(() => import("../admin/FaceAppeals"));

export default function ReviewsHub() {
  const role = getContextRole();
  const { kind = "manual" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const counts = useNavCounts(role);
  const base = `/${role}/dashboard/reviews`;
  const tabs = [
    { key: "manual", label: "ID Attendance", count: counts.manual },
    ...(role === "admin" ? [{ key: "face-appeals", label: "Face Appeals", count: counts.appeals }] : []),
    { key: "excuses", label: "Excuses", count: counts.excuses },
  ];
  if (!tabs.some(tab => tab.key === kind)) return <Navigate to={`${base}/manual`} replace />;
  return <div className="space-y-5 min-w-0">
    <PageHeader title="Reviews" subtitle="Review attendance requests and excuse letters in one place." />
    <Tabs className={`reviews-tabs ${role === "admin" ? "reviews-tabs-admin" : ""}`} active={kind} tabs={tabs} onChange={tab => navigate(`${base}/${tab}`)} />
    <Suspense fallback={<RouteFallback />}>
      {kind === "manual" ? <ManualAttendanceReviews key={location.search} defaultView="review" /> : kind === "face-appeals" ? <FaceAppeals /> : <ManageExcuses />}
    </Suspense>
  </div>;
}
