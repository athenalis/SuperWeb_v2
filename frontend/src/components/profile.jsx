import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../lib/axios";

/* =========================
   HELPER
========================= */
const getNameFromEmail = (email = "") => {
  if (!email) return "Guest";

  // ambil sebelum @
  const base = email.split("@")[0];

  // hapus angka
  const clean = base.replace(/[0-9]/g, "");

  // kalau cuma 1 kata (admin)
  if (!clean.includes(".")) {
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  // kalau ada pemisah
  return clean
    .split(/[.\-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const getInitials = (name = "") => {
  if (!name || name === "Guest") return "G";

  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export default function Profile() {
  const [open, setOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [storedPassword, setStoredPassword] = useState("••••••••");
  const ref = useRef(null);
  const navigate = useNavigate();

  const email = localStorage.getItem("email");
  const name = getNameFromEmail(email);
  const initials = getInitials(name);

  // Refresh password saat modal dibuka
  useEffect(() => {
    if (showProfileModal) {
      const pwd = localStorage.getItem("password");
      setStoredPassword(pwd || "Password tidak tersedia");
    }
  }, [showProfileModal]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navbar.jsx & Profile.jsx
  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.error("Logout error:", err);
      toast.error("Logout gagal, tapi session tetap dibersihkan");
    } finally {
      localStorage.clear();
      navigate("/login");
    }
  };
  
  const copyToClipboard = async (text, label) => {
    try {
      // Modern clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} berhasil disalin!`);
      } else {
        // Fallback untuk browser lama atau HTTP
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        toast.success(`${label} berhasil disalin!`);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(`Gagal menyalin ${label}`);
    }
  };

  return (
    <>
      <div className="relative" ref={ref}>
        {/* AVATAR */}
        <button
          onClick={() => setOpen(!open)}
          className={`
            w-11 h-11 rounded-full bg-white text-blue-800
            flex items-center justify-center font-bold
            transition
            ${open
              ? "ring-2 ring-white ring-offset-2 ring-offset-blue-900"
              : "hover:ring-2 hover:ring-white/70 hover:ring-offset-2 hover:ring-offset-blue-900"
            }
          `}
        >
          {initials}
        </button>

        {/* DROPDOWN */}
        {open && (
          <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg border z-50">
            <div className="px-4 py-3 border-b">
              <div className="text-sm font-semibold text-slate-800">
                {name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {email}
              </div>
            </div>

            {/* PROFILE BUTTON */}
            <button
              onClick={() => {
                setShowProfileModal(true);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3
                         text-sm text-slate-700 hover:bg-slate-50 transition"
            >
              <Icon icon="mdi:account-circle-outline" width="18" />
              Profile
            </button>

            {/* LOGOUT BUTTON */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3
                         text-sm text-red-600 hover:bg-red-50 transition border-t"
            >
              <Icon icon="solar:logout-2-outline" width="18" />
              Logout
            </button>
          </div>
        )}
      </div>

      {/* PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* HEADER */}
            <div className="bg-blue-900 px-6 py-8 flex flex-col items-center">
              {/* AVATAR BESAR */}
              <div className="w-20 h-20 rounded-full bg-white text-blue-900 
                              flex items-center justify-center text-2xl font-bold
                              shadow-lg">
                {initials}
              </div>
              <h2 className="text-white text-xl font-bold mt-4">{name}</h2>
              <p className="text-blue-200 text-sm">{localStorage.getItem("role") || "User"}</p>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-4">

              {/* NAMA */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Nama
                </label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
                  <Icon icon="mdi:account-outline" className="text-slate-400" width="20" />
                  <span className="flex-1 text-slate-800 font-medium">{name}</span>
                  <button
                    onClick={() => copyToClipboard(name, "Nama")}
                    className="text-slate-400 hover:text-blue-600 transition"
                    title="Copy"
                  >
                    <Icon icon="mdi:content-copy" width="18" />
                  </button>
                </div>
              </div>

              {/* EMAIL */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Email
                </label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
                  <Icon icon="mdi:email-outline" className="text-slate-400" width="20" />
                  <span className="flex-1 text-slate-800 font-medium truncate">{email}</span>
                  <button
                    onClick={() => copyToClipboard(email, "Email")}
                    className="text-slate-400 hover:text-blue-600 transition"
                    title="Copy"
                  >
                    <Icon icon="mdi:content-copy" width="18" />
                  </button>
                </div>
              </div>

              {/* PASSWORD */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Password
                </label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-3 bg-slate-50">
                  <Icon icon="mdi:lock-outline" className="text-slate-400" width="20" />
                  <span className="flex-1 text-slate-800 font-medium">
                    {showPassword ? storedPassword : "••••••••"}
                  </span>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-blue-600 transition"
                    title={showPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    <Icon icon={showPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"} width="18" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(storedPassword, "Password")}
                    className="text-slate-400 hover:text-blue-600 transition"
                    title="Copy"
                  >
                    <Icon icon="mdi:content-copy" width="18" />
                  </button>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowPassword(false);
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 
                           py-3 rounded-lg font-medium transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
