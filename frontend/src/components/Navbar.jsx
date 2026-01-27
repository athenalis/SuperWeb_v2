import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Profile from "../components/profile";
import { Icon } from "@iconify/react";
import api from "../lib/axios";

const getNameFromEmail = (email = "") => {
  if (!email) return "Guest";

  const base = email.split("@")[0];
  const clean = base.replace(/[0-9]/g, "");

  return clean
    .split(/[.\-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [openSuara, setOpenSuara] = useState(false);
  const [role, setRole] = useState("");
  const [name, setName] = useState("Guest");
  const navigate = useNavigate();
  const location = useLocation();

  const handleNotificationClick = () => {
    if (location.pathname === '/inbox') {
      if (role === 'relawan') {
        navigate('/kunjungan');
      } else if (role === 'koordinator') {
        navigate('/relawan');
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/inbox');
    }
    setOpen(false);
  };
  // Navbar.jsx & Profile.jsx
  const handleLogout = async () => {
    try {
      // ✅ Panggil API logout dulu
      await api.post("/logout");
      toast.success("Berhasil logout");
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Logout gagal, tapi session tetap dibersihkan");
    } finally {
      // ✅ Bersihkan localStorage terakhir
      localStorage.clear();
      navigate("/login");
    }
  };

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const email = localStorage.getItem("email");
    setRole(localStorage.getItem("role") || "");
    const nameStr = getNameFromEmail(email);
    setName(nameStr);

    if (localStorage.getItem("token")) {
      fetchUnreadCount();
      // Polling every 2 minutes
      const interval = setInterval(fetchUnreadCount, 120000);

      // Listen for custom event when notification is read
      const handleNotificationRead = () => {
        fetchUnreadCount();
      };
      window.addEventListener('notification-read', handleNotificationRead);

      return () => {
        clearInterval(interval);
        window.removeEventListener('notification-read', handleNotificationRead);
      };
    }
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications");
      if (res.data.success) {
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      // Silent fail - notification is not critical
      // Only log if it's not a 403 (forbidden) error
      if (err.response?.status !== 403) {
        console.error("Failed to fetch notification count", err);
      }
    }
  };

  /* ===== MENU UTAMA ===== */
  // Superadmin tidak boleh akses menu manapun, tapi Profile tetap bisa diakses
  const menus = [
    { name: "Dashboard", path: "/dashboard", show: ["admin_paslon"] },
    { name: "Koordinator", path: "/koordinator", show: ["admin_paslon"] },
    { name: "Relawan", path: "/relawan", show: ["admin_paslon", "koordinator_kunjungan"] },
    { name: "Konten", path: "/content", show: ["admin_paslon"] },
    { name: "Kunjungan", path: "/kunjungan", show: ["relawan"] },
  ];

  /* ===== SUB MENU SUARA ===== */
  const suaraMenus = [
    { name: "Dashboard", path: "/suara/dashboard" },
    { name: "Paslon", path: "/suara/paslon" },
    { name: "Partai", path: "/suara/partai" },
    { name: "DPT", path: "/suara/dpt" }, // ✅ DPT MASUK SINI
    { name: "Analisis", path: "/suara/analisis" },
  ];

  // Superadmin juga tidak bisa melihat menu Suara
  const canSeeSuara = ["admin_paslon"].includes(role) && role !== 'superadmin';

  return (
    <nav className="sticky top-0 z-50 bg-blue-900 text-white shadow-md shadow-black/60">
      <div className="h-20 px-6 flex items-center justify-between">

        {/* LEFT */}
        <div className="flex items-center gap-10">
          <div className="text-2xl font-bold tracking-wide">
            SuperWeb
          </div>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex gap-8 text-md font-medium items-center">
            {menus
              .filter(m => m.show.includes(role))
              .map(menu => (
                <NavLink
                  key={menu.name}
                  to={menu.path}
                  className={({ isActive }) =>
                    `relative pb-2 transition
                     after:absolute after:left-0 after:-bottom-1
                     after:h-[2px] after:w-full after:origin-left
                     after:scale-x-0 after:bg-white after:transition-transform
                     ${isActive ? "after:scale-x-100" : "hover:after:scale-x-100"}`
                  }
                >
                  {menu.name}
                </NavLink>
              ))}

            {/* ===== SUARA DROPDOWN (DESKTOP) ===== */}
            {canSeeSuara && (
              <div className="relative flex items-center">
                <button
                  onClick={() => setOpenSuara(!openSuara)}
                  className="flex items-center gap-1 pb-2 font-medium relative transition
                            after:absolute after:left-0 after:-bottom-1
                            after:h-[2px] after:w-full after:origin-left
                            after:scale-x-0 after:bg-white after:transition-transform
                            hover:after:scale-x-100">
                  <span>Suara</span>
                  <Icon
                    icon="mdi:chevron-down"
                    className={`text-lg translate-y-[1px] transition-transform duration-300 ${openSuara ? "rotate-180" : "rotate-0"
                      }`}
                  />
                </button>

                {openSuara && (
                  <div
                    className="absolute top-full left-0 mt-3 w-48
                              bg-white text-slate-800 rounded-lg shadow-lg
                              overflow-hidden z-50"
                  >
                    {suaraMenus.map(sm => (
                      <NavLink
                        key={sm.name}
                        to={sm.path}
                        onClick={() => setOpenSuara(false)}
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm hover:bg-blue-50 transition
                          ${isActive ? "bg-blue-100 font-semibold" : ""}`
                        }
                      >
                        {sm.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="hidden md:flex items-center gap-4">

          {/* INBOX – HANYA KOORDINATOR & RELAWAN */}
          {(role === "koordinator" || role === "relawan") && (
            <button
              onClick={handleNotificationClick}
              className="relative p-2 rounded-full hover:bg-blue-800 transition"
              title="Notifikasi"
            >
              <div className={`transition-transform origin-top ${unreadCount > 0 ? 'animate-swing' : 'hover:animate-swing'}`}>
                <Icon
                  icon="mdi:bell"
                  width={22}
                  className="text-white"
                />
              </div>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border border-blue-900 shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* USER NAME */}
          <span className="text-sm font-medium">{name}</span>

          {/* PROFILE */}
          <Profile />
        </div>


        {/* MOBILE RIGHT ACTIONS */}
        <div className="md:hidden flex items-center gap-3">
          {/* MOBILE NOTIFICATION */}
          {(role === "koordinator" || role === "relawan") && (
            <button
              onClick={handleNotificationClick}
              className="relative p-1"
              title="Notifikasi"
            >
              <div className={`transition-transform origin-top ${unreadCount > 0 ? 'animate-swing' : 'active:animate-swing'}`}>
                <Icon
                  icon="mdi:bell"
                  width={24}
                  className="text-white"
                />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border border-blue-900 shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* HAMBURGER */}
          <button
            onClick={() => setOpen(!open)}
            className="text-3xl font-bold"
          >
            ☰
          </button>
        </div>
      </div>

      {/* ===== MOBILE MENU ===== */}
      {open && (
        <div className="md:hidden bg-blue-900 px-6 pb-6 space-y-4">

          {/* MENU UTAMA */}
          {menus
            .filter(m => m.show.includes(role))
            .map(menu => (
              <NavLink
                key={menu.name}
                to={menu.path}
                onClick={() => setOpen(false)}
                className="block text-lg font-medium"
              >
                {menu.name}
              </NavLink>
            ))}

          {/* SUARA MOBILE */}
          {canSeeSuara && (
            <div>
              <button
                onClick={() => setOpenSuara(!openSuara)}
                className="flex items-center gap-2 text-lg font-medium"
              >
                Suara
                <Icon icon="mdi:chevron-down" />
              </button>

              {openSuara && (
                <div className="pl-4 mt-2 space-y-2">
                  {suaraMenus.map(sm => (
                    <NavLink
                      key={sm.name}
                      to={sm.path}
                      onClick={() => {
                        setOpen(false);
                        setOpenSuara(false);
                      }}
                      className="block text-base"
                    >
                      {sm.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== USER + PROFILE + LOGOUT ===== */}
          <div className="pt-4 border-t border-blue-700 flex items-center justify-between">

            {/* USER INFO + PROFILE */}
            <div className="flex items-center gap-3">
              {/* PROFILE COMPONENT */}
              <Profile />

              <div className="text-sm leading-tight">
                <div className="text-blue-200">Login sebagai</div>
                <div className="font-semibold text-white truncate max-w-[140px]">
                  {name}
                </div>
              </div>
            </div>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-red-400
                           hover:text-red transition"
              title="Logout"
            >
              <Icon icon="solar:logout-2-outline" width={22} />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
