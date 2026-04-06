import { Navigate } from "react-router-dom";
import { getUserRole } from "../utils/auth";

const ProtectedRoute = ({ children, allowedRole }) => {
  const role = getUserRole();

  // Not logged in
  if (!role) {
    return <Navigate to="/" replace />;
  }

  // Wrong role
  if (role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;