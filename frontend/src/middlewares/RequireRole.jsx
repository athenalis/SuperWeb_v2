import { Navigate, Outlet } from "react-router-dom";

export default function RequireRole({ allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // kalau belum login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // kalau role tidak diizinkan
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
