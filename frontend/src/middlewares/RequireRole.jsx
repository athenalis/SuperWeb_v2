import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireRole({ allowedRoleIds = [] }) {
  const token = localStorage.getItem("token");
  const roleId = Number(localStorage.getItem("role_id"));
  const location = useLocation();

  // belum login
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  // kalau tidak ada restriction, izinkan (lebih aman untuk dev)
  if (!Array.isArray(allowedRoleIds) || allowedRoleIds.length === 0) {
    return <Outlet />;
  }

  const ok = Number.isFinite(roleId) && allowedRoleIds.includes(roleId);

  if (!ok) {
    // lebih enak UX-nya kalau ke halaman unauthorized,
    // tapi kalau belum ada, boleh ke dashboard dulu.
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
