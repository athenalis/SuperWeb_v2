import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
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
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // dropdown states
  const [openSuara, setOpenSuara] = useState(false);
  const [openKoordinator, setOpenKoordinator] = useState(false);
  const [openRelawan, setOpenRelawan] = useState(false);

  const [role, setRole] = useState("");
  const [name, setName] = useState("Guest");
  const [unreadCount, setUnreadCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  // refs (click outside to close dropdowns)
  const suaraRef = useRef(null);
  const koorRef = useRef(null);
  const relawanRef = useRef(null);

  const closeAllDropdowns = () => {
    setOpenSuara(false);
    setOpenKoordinator(false);
    setOpenRelawan(false);
  };

  const handleNotificationClick = () => {
    if (location.pathname === "/inbox") {
      if (role === "relawan") {
        navigate("/kunjungan");
      } else if (role === "kunjungan_koordinator") {
        navigate("/relawan/kunjungan");
      } else {
        navigate("/dashboard");
      }
    } else {
      navigate("/inbox");
    }
    setOpen(false);
    closeAllDropdowns();
  };

  const handleLogout = async () => {
    try {
      await api.post("/logout");
      toast.success("Berhasil logout");
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Logout gagal, tapi session tetap dibersihkan");
    } finally {
      localStorage.clear();
      navigate("/login");
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications");
      if (res.data.success) {
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      if (err.response?.status !== 403) {
        console.error("Failed to fetch notification count", err);
      }
    }
  };

  // init role + name + notification polling
  useEffect(() => {
    const email = localStorage.getItem("email");
    setRole(localStorage.getItem("role") || "");
    setName(getNameFromEmail(email));

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

  // close dropdowns when route changes
  useEffect(() => {
    closeAllDropdowns();
    setOpen(false);
  }, [location.pathname]);

  // click outside dropdowns to close
  useEffect(() => {
    const onDocMouseDown = (e) => {
      const t = e.target;
      const insideSuara = suaraRef.current?.contains(t);
      const insideKoor = koorRef.current?.contains(t);
      const insideRelawan = relawanRef.current?.contains(t);

      if (!insideSuara && !insideKoor && !insideRelawan) {
        closeAllDropdowns();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  /* ===== MENU UTAMA (URUTAN DI SINI) ===== */
  const menus = [
    { name: "Dashboard", path: "/dashboard", show: ["admin_paslon"] },

    // dropdown slots (urutan penting)  
    { name: "Koordinator", path: "/koordinator/kunjungan", show: ["admin_paslon"] },
    { name: "Relawan", path: "/relawan", show: ["admin_paslon", "kunjungan_koordinator", "apk_koordinator"] },

    // konten harus setelah relawan -> taro di sini
    { name: "Konten", path: "/konten", show: ["admin_paslon"] },

    // Suara juga dropdown slot (posisi sesuai mau lo taro di mana)
    { name: "Suara", path: "/suara/dashboard", show: ["admin_paslon"] },

    { name: "APK", path: "/apk", show: ["admin_paslon", "admin_apk", "apk_koordinator", "apk_kurir"] },

    { name: "Kunjungan", path: "/kunjungan", show: ["relawan"] },
  ];

  /* ===== SUB MENU ===== */
  const suaraMenus = [
    { name: "Dashboard", path: "/suara/dashboard" },
    { name: "Paslon", path: "/suara/paslon" },
    { name: "Partai", path: "/suara/partai" },
    { name: "DPT", path: "/suara/dpt" },
    { name: "Analisis", path: "/suara/analisis" },
  ];

  // ubah sesuai route project lo
  const koordinatorMenus = [
    { name: "Koordinator Kunjungan", path: "/koordinator/kunjungan" },
    { name: "Koordinator APK", path: "/koordinator/apk" },
  ];

  const relawanMenus = (() => {
    if (role === "kunjungan_koordinator") {
      return [{ name: "Relawan Kunjungan", path: "/relawan/kunjungan" }];
    }

    if (role === "apk_koordinator") {
      return [{ name: "Relawan APK", path: "/relawan/apk" }];
    }

    // admin
    return [
      { name: "Relawan Kunjungan", path: "/relawan/kunjungan" },
      { name: "Relawan APK", path: "/relawan/apk" },
    ];
  })();

  // role check
  const canSeeSuara = ["admin_paslon"].includes(role) && role !== "superadmin";
  const canSeeKoordinator = ["admin_paslon"].includes(role);
  const canSeeRelawan = ["admin_paslon", "kunjungan_koordinator", "apk_koordinator"].includes(role);

  // styling helper
  const underlineClass = (isActive) =>
    `relative pb-2 transition
     after:absolute after:left-0 after:-bottom-1
     after:h-[2px] after:w-full after:origin-left
     after:scale-x-0 after:bg-white after:transition-transform
     ${isActive ? "after:scale-x-100" : "hover:after:scale-x-100"}`;

  const dropdownButtonClass =
    "flex items-center gap-1 pb-2 font-medium relative transition " +
    "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:origin-left " +
    "after:scale-x-0 after:bg-white after:transition-transform hover:after:scale-x-100";

  const dropdownMenuClass =
    "absolute top-full left-0 mt-3 w-56 bg-white text-slate-800 rounded-lg shadow-lg overflow-hidden z-50";

  const dropdownItemClass = (isActive) =>
    `block px-4 py-2 text-sm hover:bg-blue-50 transition ${
      isActive ? "bg-blue-100 font-semibold" : ""
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-blue-900 text-white shadow-md shadow-black/60">
      <div className="h-20 px-6 flex items-center justify-between">
        {/* LEFT */}
        <div className="flex items-center gap-10">
          <div className="text-2xl font-bold tracking-wide">SuperWeb</div>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex gap-8 text-md font-medium items-center">
            {menus
              .filter((m) => m.show.includes(role))
              .map((menu) => {
                // KOORDINATOR dropdown slot
                if (menu.name === "Koordinator") {
                  if (!canSeeKoordinator) return null;
                  return (
                    <div key="Koordinator" ref={koorRef} className="relative flex items-center">
                      <button
                        onClick={() => {
                          setOpenKoordinator((v) => !v);
                          setOpenRelawan(false);
                          setOpenSuara(false);
                        }}
                        className={dropdownButtonClass}
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
                        <div className={dropdownMenuClass}>
                          {koordinatorMenus.map((sm) => (
                            <NavLink
                              key={sm.name}
                              to={sm.path}
                              onClick={() => setOpenKoordinator(false)}
                              className={({ isActive }) => dropdownItemClass(isActive)}
                            >
                              {sm.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                if (menu.name === "Relawan") {
                  if (!canSeeRelawan) return null;

                  // 🔒 KUNJUNGAN KOORDINATOR
                  if (role === "kunjungan_koordinator") {
                    return (
                      <NavLink
                        key="Relawan"
                        to="/relawan/kunjungan"
                        className={({ isActive }) => underlineClass(isActive)}
                      >
                        Relawan
                      </NavLink>
                    );
                  }

                  // 🔒 APK KOORDINATOR
                  if (role === "apk_koordinator") {
                    return (
                      <NavLink
                        key="Relawan"
                        to="/relawan/apk"
                        className={({ isActive }) => underlineClass(isActive)}
                      >
                        Relawan
                      </NavLink>
                    );
                  }

                  // ✅ ADMIN → DROPDOWN
                  return (
                    <div key="Relawan" ref={relawanRef} className="relative flex items-center">
                      <button
                        onClick={() => {
                          setOpenRelawan((v) => !v);
                          setOpenKoordinator(false);
                          setOpenSuara(false);
                        }}
                        className={dropdownButtonClass}
                      >
                        <span>Relawan</span>
                        <Icon
                          icon="mdi:chevron-down"
                          className={`text-lg transition-transform ${
                            openRelawan ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {openRelawan && (
                        <div className={dropdownMenuClass}>
                          {relawanMenus.map((sm) => (
                            <NavLink
                              key={sm.name}
                              to={sm.path}
                              onClick={() => setOpenRelawan(false)}
                              className={({ isActive }) => dropdownItemClass(isActive)}
                            >
                              {sm.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                // SUARA dropdown slot
                if (menu.name === "Suara") {
                  if (!canSeeSuara) return null;
                  return (
                    <div key="Suara" ref={suaraRef} className="relative flex items-center">
                      <button
                        onClick={() => {
                          setOpenSuara((v) => !v);
                          setOpenKoordinator(false);
                          setOpenRelawan(false);
                        }}
                        className={dropdownButtonClass}
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
                        <div className="absolute top-full left-0 mt-3 w-48 bg-white text-slate-800 rounded-lg shadow-lg overflow-hidden z-50">
                          {suaraMenus.map((sm) => (
                            <NavLink
                              key={sm.name}
                              to={sm.path}
                              onClick={() => setOpenSuara(false)}
                              className={({ isActive }) => dropdownItemClass(isActive)}
                            >
                              {sm.name}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                // default menu (non-dropdown)
                return (
                  <NavLink
                    key={menu.name}
                    to={menu.path}
                    className={({ isActive }) => underlineClass(isActive)}
                  >
                    {menu.name}
                  </NavLink>
                );
              })}
          </div>
        </div>

        {/* RIGHT */}
        <div className="hidden md:flex items-center gap-4">
          {(role === "kunjungan_koordinator" || role === "relawan") && (
            <button
              onClick={handleNotificationClick}
              className="relative p-2 rounded-full hover:bg-blue-800 transition"
              title="Notifikasi"
            >
              <div
                className={`transition-transform origin-top ${
                  unreadCount > 0 ? "animate-swing" : "hover:animate-swing"
                }`}
              >
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
          {(role === "kunjungan_koordinator" || role === "relawan") && (
            <button onClick={handleNotificationClick} className="relative p-1" title="Notifikasi">
              <div
                className={`transition-transform origin-top ${
                  unreadCount > 0 ? "animate-swing" : "active:animate-swing"
                }`}
              >
                <Icon icon="mdi:bell" width={24} className="text-white" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border border-blue-900 shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => {
              setOpen((v) => !v);
              closeAllDropdowns();
            }}
            className="text-3xl font-bold"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* ===== MOBILE MENU ===== */}
      {open && (
        <div className="md:hidden bg-blue-900 px-6 pb-6 space-y-4">
          {menus
            .filter((m) => m.show.includes(role))
            .map((menu) => {
              // KOORDINATOR MOBILE
              if (menu.name === "Koordinator") {
                if (!canSeeKoordinator) return null;
                return (
                  <div key="Koordinator">
                    <button
                      onClick={() => {
                        setOpenKoordinator((v) => !v);
                        setOpenRelawan(false);
                        setOpenSuara(false);
                      }}
                      className="flex items-center gap-2 text-lg font-medium"
                    >
                      Koordinator
                      <Icon
                        icon="mdi:chevron-down"
                        className={`transition-transform ${openKoordinator ? "rotate-180" : ""}`}
                      />
                    </button>

                    {openKoordinator && (
                      <div className="pl-4 mt-2 space-y-2">
                        {koordinatorMenus.map((sm) => (
                          <NavLink
                            key={sm.name}
                            to={sm.path}
                            onClick={() => {
                              setOpen(false);
                              setOpenKoordinator(false);
                            }}
                            className="block text-base"
                          >
                            {sm.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

if (menu.name === "Relawan") {
  if (!canSeeRelawan) return null;

  if (role === "kunjungan_koordinator") {
    return (
      <NavLink
        key="Relawan"
        to="/relawan/kunjungan"
        onClick={() => setOpen(false)}
        className="block text-lg font-medium"
      >
        Relawan
      </NavLink>
    );
  }

  if (role === "apk_koordinator") {
    return (
      <NavLink
        key="Relawan"
        to="/relawan/apk"
        onClick={() => setOpen(false)}
        className="block text-lg font-medium"
      >
        Relawan
      </NavLink>
    );
  }

  // admin dropdown
  return (
    <div key="Relawan">
      <button
        onClick={() => {
          setOpenRelawan((v) => !v);
          setOpenKoordinator(false);
          setOpenSuara(false);
        }}
        className="flex items-center gap-2 text-lg font-medium"
      >
        Relawan
        <Icon
          icon="mdi:chevron-down"
          className={`transition-transform ${
            openRelawan ? "rotate-180" : ""
          }`}
        />
      </button>

      {openRelawan && (
        <div className="pl-4 mt-2 space-y-2">
          {relawanMenus.map((sm) => (
            <NavLink
              key={sm.name}
              to={sm.path}
              onClick={() => {
                setOpen(false);
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
  );
}

              // SUARA MOBILE
              if (menu.name === "Suara") {
                if (!canSeeSuara) return null;
                return (
                  <div key="Suara">
                    <button
                      onClick={() => {
                        setOpenSuara((v) => !v);
                        setOpenKoordinator(false);
                        setOpenRelawan(false);
                      }}
                      className="flex items-center gap-2 text-lg font-medium"
                    >
                      Suara
                      <Icon
                        icon="mdi:chevron-down"
                        className={`transition-transform ${openSuara ? "rotate-180" : ""}`}
                      />
                    </button>

                    {openSuara && (
                      <div className="pl-4 mt-2 space-y-2">
                        {suaraMenus.map((sm) => (
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
                );
              }

              // default menu mobile
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

          {/* USER + PROFILE + LOGOUT */}
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
