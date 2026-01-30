import { Navigate, Outlet, useLocation } from "react-router-dom";

/**
 * ROLE ID MAPPING (dari database):
 * 1 = superadmin
 * 2 = admin_paslon
 * 3 = admin_apk
 * 4 = kunjungan_koordinator
 * 5 = apk_koordinator
 * 6 = relawan
 * 7 = apk_kurir
 */
const getRoleDefaultPath = (roleId) => {
  switch (roleId) {
    case 1: return "/superadmin";
    case 2: return "/dashboard";
    case 3: return "/apk";
    case 4: return "/relawan";
    case 5: return "/apk";
    case 6: return "/kunjungan";
    case 7: return "/apk";
    default: return "/dashboard"; // Fallback ke dashboard, bukan login
  }
};

export default function RequireRole({ allowedRoleIds = [] }) {
  const token = localStorage.getItem("token");
  const roleIdRaw = localStorage.getItem("role_id");
  const roleId = roleIdRaw ? Number(roleIdRaw) : null;
  const location = useLocation();

  // Debug log (bisa dihapus nanti)
  console.log("[RequireRole] token:", !!token, "roleId:", roleId, "path:", location.pathname);

  // belum login (tidak ada token)
  if (!token) {
    console.log("[RequireRole] No token, redirecting to /login");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // kalau tidak ada restriction, izinkan semua yang sudah login
  if (!Array.isArray(allowedRoleIds) || allowedRoleIds.length === 0) {
    return <Outlet />;
  }

  // Check apakah role diizinkan
  const ok = roleId !== null && Number.isFinite(roleId) && allowedRoleIds.includes(roleId);

  if (!ok) {
    // Redirect ke halaman default sesuai role user untuk mencegah loop
    const defaultPath = getRoleDefaultPath(roleId);
    console.log("[RequireRole] Role not allowed, redirecting to:", defaultPath);

    // Jika sudah di default path, izinkan (mencegah infinite loop)
    if (location.pathname === defaultPath) {
      return <Outlet />;
    }

    return <Navigate to={defaultPath} replace />;
  }

  return <Outlet />;
}
