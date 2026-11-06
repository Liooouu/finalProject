import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getContextRole } from "../../utils/auth";

/** Keep existing dashboard links, bookmarks, and notification URLs working. */
export default function ReviewRedirect({ kind }) {
  const location = useLocation();
  return <Navigate to={`/${getContextRole()}/dashboard/reviews/${kind}${location.search}${location.hash}`} replace />;
}
