import React from "react";
import { Navigate } from "react-router-dom";
import { getUserRole } from "../utils/auth";

const ProtectedRoute = ({ children, allowedRole }) => {
  const role = getUserRole();

  // Not logged in
  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  // Wrong role
  if (role !== allowedRole) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;