import React, { useEffect, useReducer } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getUserFromToken, markRoleActive } from "../utils/auth";

const ProtectedRoute = ({ allowedRoles }) => {
  const [, refreshSession] = useReducer(value => value + 1, 0);
  useEffect(() => {
    const onStorage = event => {
      if (!event.key || event.key === "token" || event.key.startsWith("token_")) refreshSession();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshSession);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshSession);
    };
  }, []);
  const user = getUserFromToken();

  // Every successful pass through a role's routes counts as "actively using
  // this role" — keeps last_role fresh so "/" sends people back to the portal
  // they were last in, not whichever account logged in most recently.
  useEffect(() => {
    if (user?.role) markRoleActive(user.role);
  }, [user?.role]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;