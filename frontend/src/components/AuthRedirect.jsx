import { Navigate } from "react-router-dom";
import * as jwtDecode from "jwt-decode"; 

const AuthRedirect = ({ children }) => {
  const token = localStorage.getItem("token");
  if (!token) return children;

  try {
    const decoded = jwtDecode(token);
    const role = decoded.role;

    if (role === "student") return <Navigate to="/student-dashboard" replace />;
    if (role === "admin") return <Navigate to="/admin-dashboard" replace />;
    if (role === "organizer") return <Navigate to="/organizer-dashboard" replace />;

    return children;
  } catch {
    return children;
  }
};

export default AuthRedirect;