import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Profile from "../components/profile";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
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

  const ROLE = {
    SUPERADMIN: 1,
    ADMIN_PASLON: 2,
    ADMIN_APK: 3,
    KOORD_KUNJUNGAN: 4, // kunjungan_koordinator
    KOORD_APK: 5,       // apk_koordinator
    RELAWAN: 6,         // relawan (anggap relawan_kunjungan)
    KURIR_APK: 7,       // apk_kurir
    // RELAWAN_APK: 8,  // <-- kalau nanti ada, isi di sini
  };

  const hasAny = (roleId, allowed = []) => allowed.includes(roleId);


export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [openSuara, setOpenSuara] = useState(false);

  // ✅ dropdown states (Koordinator & Relawan)
  const [openKoordinator, setOpenKoordinator] = useState(false);
  const [openRelawan, setOpenRelawan] = useState(false);

  const [name, setName] = useState("Guest");
  const navigate = useNavigate();
  const location = useLocation();

  const handleNotificationClick = () => {
    if (location.pathname === "/inbox") {
      if (roleId === ROLE.RELAWAN) {
        navigate("/kunjungan");
      } else if (roleId === ROLE.KOORD_KUNJUNGAN) {
        navigate("/relawan");
      } else {
        navigate("/dashboard");
      }
    } else {
      navigate("/inbox");
    }
    setOpen(false);
  };
  
    const [roleId, setRoleId] = useState(null);
    useEffect(() => {
    const email = localStorage.getItem("email");
    setName(getNameFromEmail(email));

    // simpan role_id di localStorage: "role_id"
    const rid = Number(localStorage.getItem("role_id")); 
    setRoleId(Number.isFinite(rid) ? rid : null);

    if (localStorage.getItem("token")) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 120000);

      const handleNotificationRead = () => fetchUnreadCount();
      window.addEventListener("notification-read", handleNotificationRead);

      return () => {
        clearInterval(interval);
        window.removeEventListener("notification-read", handleNotificationRead);
      };
    }
  }, []);

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
  const menus = [
  { name: "Dashboard", path: "/dashboard", show: [ROLE.ADMIN_PASLON] },

  { name: "Koordinator", path: "/koordinator", show: [ROLE.ADMIN_PASLON] },

  // Relawan menu utama tampil utk admin_paslon & koord_kunjungan (sesuai rule 2)
  { name: "Relawan", path: "/relawan", show: [ROLE.ADMIN_PASLON, ROLE.KOORD_KUNJUNGAN] },

  { name: "Konten", path: "/content", show: [ROLE.ADMIN_PASLON] },

  // APK menu utama: koord_apk & kurir_apk & (relawan_apk kalau ada)
  { name: "APK", path: "/apk", show: [ROLE.KOORD_APK, ROLE.KURIR_APK /*, ROLE.RELAWAN_APK*/] },

  // Kunjungan hanya relawan (rule 6)
  { name: "Kunjungan", path: "/kunjungan", show: [ROLE.RELAWAN] },
];


  /* ✅ SUB MENU KOORDINATOR (dropdown) */
const koordinatorMenus = [
  { name: "Koordinator Kunjungan", path: "/koordinator/kunjungan", show: [ROLE.ADMIN_PASLON] },
  { name: "Koordinator APK", path: "/koordinator/apk", show: [ROLE.ADMIN_PASLON] },
];


  /* ✅ SUB MENU RELAWAN (dropdown) */
const relawanMenus = [
  { name: "Data Relawan", path: "/relawan", show: [ROLE.ADMIN_PASLON, ROLE.KOORD_KUNJUNGAN] },
  { name: "Tambah Relawan", path: "/relawan/create", show: [ROLE.KOORD_KUNJUNGAN] },
];

  /* ===== SUB MENU SUARA ===== */
  const suaraMenus = [
    { name: "Dashboard", path: "/suara/dashboard" },
    { name: "Paslon", path: "/suara/paslon" },
    { name: "Partai", path: "/suara/partai" },
    { name: "DPT", path: "/suara/dpt" }, // ✅ DPT MASUK SINI
    { name: "Analisis", path: "/suara/analisis" },
  ];

const canSeeSuara = roleId === ROLE.ADMIN_PASLON;

  // ✅ close dropdown when route changes
  useEffect(() => {
    setOpenSuara(false);
    setOpenKoordinator(false);
    setOpenRelawan(false);
  }, [location.pathname]);

  const canSeeKoordinator = menus.find(m => m.name === "Koordinator")?.show?.includes(roleId);
  const canSeeRelawan = menus.find(m => m.name === "Relawan")?.show?.includes(roleId);

  return (
    <nav className="sticky top-0 z-50 bg-blue-900 text-white shadow-md shadow-black/60">
      <div className="h-20 px-6 flex items-center justify-between">
        {/* LEFT */}
        <div className="flex items-center gap-10">
          <div className="text-2xl font-bold tracking-wide">SuperWeb</div>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex gap-8 text-md font-medium items-center">
            {menus
            .filter(m => m.show.includes(roleId))
              .map(menu => {
                // ✅ Koordinator dropdown
                if (menu.name === "Koordinator" && canSeeKoordinator) {
                  const isActive =
                    location.pathname === "/koordinator" || location.pathname.startsWith("/koordinator/");
                  return (
                    <div key="KoordinatorDropdown" className="relative flex items-center">
                      <button
                        onClick={() => {
                          setOpenKoordinator(!openKoordinator);
                          setOpenRelawan(false);
                          setOpenSuara(false);
                        }}
                        className={`flex items-center gap-1 pb-2 font-medium relative transition
                          after:absolute after:left-0 after:-bottom-1
                          after:h-[2px] after:w-full after:origin-left
                          after:scale-x-0 after:bg-white after:transition-transform
                          ${isActive ? "after:scale-x-100" : "hover:after:scale-x-100"}`}
                      >
                        <span>Koordinator</span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={`text-lg translate-y-[1px] transition-transform duration-300 ${
                            openKoordinator ? "rotate-180" : "rotate-0"
                          }`}
                        />
                      </button>

                      {openKoordinator && (
                        <div
                          className="absolute top-full left-0 mt-3 w-56
                                     bg-white text-slate-800 rounded-lg shadow-lg
                                     overflow-hidden z-50"
                        >
                          {koordinatorMenus
                            .filter(km => hasAny(roleId, km.show))
                            .map(km => (
                            <NavLink
                              key={km.name}
                              to={km.path}
                              onClick={() => setOpenKoordinator(false)}
                              className={({ isActive }) =>
                                `block px-4 py-2 text-sm hover:bg-blue-50 transition
                                 ${isActive ? "bg-blue-100 font-semibold" : ""}`
                              }
                            >
                              {km.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                // ✅ Relawan dropdown
                if (menu.name === "Relawan" && canSeeRelawan) {
                  const isActive =
                    location.pathname === "/relawan" || location.pathname.startsWith("/relawan/");
                  return (
                    <div key="RelawanDropdown" className="relative flex items-center">
                      <button
                        onClick={() => {
                          setOpenRelawan(!openRelawan);
                          setOpenKoordinator(false);
                          setOpenSuara(false);
                        }}
                        className={`flex items-center gap-1 pb-2 font-medium relative transition
                          after:absolute after:left-0 after:-bottom-1
                          after:h-[2px] after:w-full after:origin-left
                          after:scale-x-0 after:bg-white after:transition-transform
                          ${isActive ? "after:scale-x-100" : "hover:after:scale-x-100"}`}
                      >
                        <span>Relawan</span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={`text-lg translate-y-[1px] transition-transform duration-300 ${
                            openRelawan ? "rotate-180" : "rotate-0"
                          }`}
                        />
                      </button>

                      {openRelawan && (
                        <div
                          className="absolute top-full left-0 mt-3 w-56
                                     bg-white text-slate-800 rounded-lg shadow-lg
                                     overflow-hidden z-50"
                        >
                          {relawanMenus
                            .filter(rm => hasAny(roleId, rm.show))
                            .map(rm => (
                            <NavLink
                              key={rm.name}
                              to={rm.path}
                              onClick={() => setOpenRelawan(false)}
                              className={({ isActive }) =>
                                `block px-4 py-2 text-sm hover:bg-blue-50 transition
                                 ${isActive ? "bg-blue-100 font-semibold" : ""}`
                              }
                            >
                              {rm.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                // ✅ default menu lain (termasuk APK menu biasa)
                return (
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
                );
              })}

            {/* ===== SUARA DROPDOWN (DESKTOP) ===== */}
            {canSeeSuara && (
              <div className="relative flex items-center">
                <button
                  onClick={() => {
                    setOpenSuara(!openSuara);
                    setOpenKoordinator(false);
                    setOpenRelawan(false);
                  }}
                  className="flex items-center gap-1 pb-2 font-medium relative transition
                            after:absolute after:left-0 after:-bottom-1
                            after:h-[2px] after:w-full after:origin-left
                            after:scale-x-0 after:bg-white after:transition-transform
                            hover:after:scale-x-100"
                >
                  <span>Suara</span>
                  <Icon
                    icon="mdi:chevron-down"
                    className={`text-lg translate-y-[1px] transition-transform duration-300 ${
                      openSuara ? "rotate-180" : "rotate-0"
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
          {hasAny(roleId, [ROLE.KOORD_KUNJUNGAN, ROLE.RELAWAN]) && (
            <button
              onClick={handleNotificationClick}
              className="relative p-2 rounded-full hover:bg-blue-800 transition"
              title="Notifikasi"
            >
              <div className={`transition-transform origin-top ${unreadCount > 0 ? "animate-swing" : "hover:animate-swing"}`}>
                <Icon icon="mdi:bell" width={22} className="text-white" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border border-blue-900 shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          <span className="text-sm font-medium">{name}</span>
          <Profile />
        </div>

        {/* MOBILE RIGHT ACTIONS */}
        <div className="md:hidden flex items-center gap-3">
          {hasAny(roleId, [ROLE.KOORD_KUNJUNGAN, ROLE.RELAWAN]) && (
            <button onClick={handleNotificationClick} className="relative p-1" title="Notifikasi">
              <div className={`transition-transform origin-top ${unreadCount > 0 ? "animate-swing" : "active:animate-swing"}`}>
                <Icon icon="mdi:bell" width={24} className="text-white" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border border-blue-900 shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          <button onClick={() => setOpen(!open)} className="text-3xl font-bold">
            ☰
          </button>
        </div>
      </div>

      {/* ===== MOBILE MENU ===== */}
      {open && (
        <div className="md:hidden bg-blue-900 px-6 pb-6 space-y-4">
          {menus
            .filter(m => m.show.includes(roleId))
            .map(menu => {
              // ✅ Koordinator dropdown (mobile)
              if (menu.name === "Koordinator" && canSeeKoordinator) {
                return (
                  <div key="KoordinatorMobile">
                    <button
                      onClick={() => {
                        setOpenKoordinator(!openKoordinator);
                        setOpenRelawan(false);
                        setOpenSuara(false);
                      }}
                      className="flex items-center gap-2 text-lg font-medium"
                    >
                      Koordinator
                      <Icon icon="mdi:chevron-down" className={`${openKoordinator ? "rotate-180" : ""} transition-transform`} />
                    </button>

                    {openKoordinator && (
                      <div className="pl-4 mt-2 space-y-2">
                        {koordinatorMenus.map(km => (
                          <NavLink
                            key={km.name}
                            to={km.path}
                            onClick={() => {
                              setOpen(false);
                              setOpenKoordinator(false);
                            }}
                            className="block text-base"
                          >
                            {km.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ✅ Relawan dropdown (mobile)
              if (menu.name === "Relawan" && canSeeRelawan) {
                return (
                  <div key="RelawanMobile">
                    <button
                      onClick={() => {
                        setOpenRelawan(!openRelawan);
                        setOpenKoordinator(false);
                        setOpenSuara(false);
                      }}
                      className="flex items-center gap-2 text-lg font-medium"
                    >
                      Relawan
                      <Icon icon="mdi:chevron-down" className={`${openRelawan ? "rotate-180" : ""} transition-transform`} />
                    </button>

                    {openRelawan && (
                      <div className="pl-4 mt-2 space-y-2">
                        {relawanMenus.map(rm => (
                          <NavLink
                            key={rm.name}
                            to={rm.path}
                            onClick={() => {
                              setOpen(false);
                              setOpenRelawan(false);
                            }}
                            className="block text-base"
                          >
                            {rm.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ✅ default menu (termasuk APK biasa)
              return (
                <NavLink
                  key={menu.name}
                  to={menu.path}
                  onClick={() => setOpen(false)}
                  className="block text-lg font-medium"
                >
                  {menu.name}
                </NavLink>
              );
            })}

          {/* SUARA MOBILE */}
          {canSeeSuara && (
            <div>
              <button
                onClick={() => {
                  setOpenSuara(!openSuara);
                  setOpenKoordinator(false);
                  setOpenRelawan(false);
                }}
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
                  setOpenKoordinator(false);
                  setOpenRelawan(false);
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
            <div className="flex items-center gap-3">
              <Profile />
              <div className="text-sm leading-tight">
                <div className="text-blue-200">Login sebagai</div>
                <div className="font-semibold text-white truncate max-w-[140px]">{name}</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-red-400 hover:text-red transition"
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
