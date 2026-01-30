import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireAuth() {
  const token = localStorage.getItem("token");
  const location = useLocation();

  // Debug log
  console.log("[RequireAuth] token:", !!token, "path:", location.pathname);

  if (!token) {
    console.log("[RequireAuth] No token, redirecting to /login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
