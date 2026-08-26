import React from "react";
import { Navigate } from "react-router-dom";
import { getUserRole } from "../utils/auth";

const AuthRedirect = ({ children }) => {
  const role = getUserRole();

  if (role === "student") return <Navigate to="/student/dashboard" replace />;
  if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
  if (role === "organizer") return <Navigate to="/organizer/dashboard" replace />;

  return children;
};

export default AuthRedirect;
