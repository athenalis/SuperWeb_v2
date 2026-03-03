import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import toast from "react-hot-toast";

/* =====================
  NORMALIZER
===================== */
function normalizeArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

async function safeGet(url) {
  const res = await api.get(url);
  return res.data;
}

/* =====================
  API
===================== */
// ✅ kalau endpoint list admin apk lu beda, ganti di sini
async function fetchAdminApkList() {
  const payload = await safeGet("/admin-apk");
  return normalizeArrayPayload(payload);
}

export default function AdminApk({ onBackToGudang }) {
  const qc = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);

  // ===== ADMIN APK FORM STATE (LOGIC LU TETEP) =====
  const [adminApkErrors, setAdminApkErrors] = useState({});
  const [adminApkLoading, setAdminApkLoading] = useState(false);
  const [adminApkResult, setAdminApkResult] = useState(null);

  const [noHpHint, setNoHpHint] = useState("");

  const [adminApkForm, setAdminApkForm] = useState({
    nama: "",
    nik: "",
    no_hp: "",
  });

  const sanitizePhone = (val) => {
    return (val || "").replace(/[^0-9+\-()\s]/g, "");
  };

  const isForbiddenLandline021 = (val) => {
    const digitsOnly = (val || "").replace(/\D/g, "");
    return digitsOnly.startsWith("021");
  };

  const setField = (key, val) => {
    setAdminApkForm((prev) => ({ ...prev, [key]: val }));
    setAdminApkErrors((prev) => {
      if (!prev?.[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // ===== QUERY LIST ADMIN APK =====
  const adminListQuery = useQuery({
    queryKey: ["admin-apk-list"],
    queryFn: fetchAdminApkList,
    staleTime: 10_000,
    retry: false,
  });

  const adminRows = useMemo(() => {
    const list = adminListQuery.data || [];

    return list.map((it, idx) => {
      const user = it.user || it?.data?.user || it;

      return {
        id: it.id || it.admin_apk?.id || it?.data?.admin_apk?.id || user?.id || idx,
        nama: user?.name || user?.nama || it?.nama || "-",
        email: user?.email || it?.email || "-",              // ✅ NEW
        nik: it?.nik || user?.nik || "-",                    // ✅ NEW
        no_hp: it?.no_hp || user?.no_hp || "-",
        raw: it,
      };
    });
  }, [adminListQuery.data]);

  // ===== SUBMIT CREATE ADMIN APK (LOGIC LU TETEP) =====
  const submitAdminApk = async () => {
    setAdminApkLoading(true);
    setAdminApkErrors({});
    setAdminApkResult(null);

    if (isForbiddenLandline021(adminApkForm.no_hp)) {
      setNoHpHint("Nomor tidak boleh diawali 021 (telepon rumah).");
      setAdminApkErrors({ no_hp: ["Nomor tidak valid. Gunakan nomor HP (bukan 021)."] });
      setAdminApkLoading(false);
      return;
    }

    try {
      const payload = {
        nama: adminApkForm.nama,
        nik: adminApkForm.nik,
        no_hp: adminApkForm.no_hp || null,
      };

      const { data } = await api.post("/admin-apk", payload, {
        headers: { Authorization: "" },
      });

      if (data?.status === false) {
        setAdminApkErrors({ general: [data?.message || "Gagal menambahkan Admin APK"] });
        return;
      }

      const email = data?.data?.user?.email;
      const password = data?.data?.user?.password;

      setAdminApkResult({
        email,
        password,
        admin_apk: data?.data?.admin_apk,
      });

      toast.success(`Admin APK berhasil dibuat!\nEmail: ${email}\nPassword: ${password}`, {
        duration: 6000,
        style: { whiteSpace: "pre-line" },
      });

      setAdminApkForm({ nama: "", nik: "", no_hp: "" });
      await qc.invalidateQueries({ queryKey: ["admin-apk-list"] });
      setShowAddModal(false);
    } catch (err) {
      const status = err?.response?.status;
      const json = err?.response?.data;

      if (!err?.response) {
        const msg = "Network/CORS error (request tidak sampai ke backend)";
        setAdminApkErrors({ general: [msg] });
        toast.error(msg);
        return;
      }

      if (json?.errors) {
        setAdminApkErrors(json.errors);
        toast.error("Gagal menyimpan. Periksa input kamu.");
      } else {
        const msg = json?.message || `Gagal menambahkan Admin APK (HTTP ${status})`;
        setAdminApkErrors({ general: [msg] });
        toast.error(msg);
      }
    } finally {
      setAdminApkLoading(false);
    }
  };

  // optional: reset state saat modal dibuka
  useEffect(() => {
    if (!showAddModal) return;
    setAdminApkForm({ nama: "", nik: "", no_hp: "" });
    setAdminApkErrors({});
    setAdminApkResult(null);
    setNoHpHint("");
  }, [showAddModal]);

  // ✅ FIX: body scroll lock biar blur/modal overlay gak “nyisa”
  useEffect(() => {
    if (!showAddModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [showAddModal]);

  const actionBtnClass =
    "flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold " +
    "hover:bg-blue-700 transition shadow-sm ring-1 ring-blue-600/10";

  const goBack = () => {
    if (typeof onBackToGudang === "function") return onBackToGudang();
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl p-6 md:p-8 space-y-6">
      {/* NAVBAR / HEADER BAR */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={goBack}
            className="mt-1 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Kembali"
          >
            <Icon icon="mdi:arrow-left" width={22} className="text-slate-700" />
          </button>

          <div>
            <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-3">
              Data Admin APK
            </h1>
            <p className="text-slate-500 mt-1">Kelola admin APK</p>
          </div>
        </div>

        <button onClick={() => setShowAddModal(true)} className={actionBtnClass} type="button">
          <Icon icon="mdi:account-plus-outline" width={20} />
          Tambah Admin APK
        </button>
      </div>

      {/* CARD LIST */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 md:p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-5">
            <Icon icon="mdi:account-group-outline" width={22} className="text-blue-600" />
            Daftar Admin APK
          </h2>

          <div className="text-sm font-semibold text-slate-500">
            {adminListQuery.isLoading
              ? "Memuat..."
              : adminListQuery.isError
              ? "Gagal memuat"
              : `${adminRows.length} admin`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-md font-bold text-slate-600 uppercase tracking-wider">
                  Nama
                </th>
                <th className="text-left px-6 py-3 text-md font-bold text-slate-600 uppercase tracking-wider">
                  NIK
                </th>
                <th className="text-left px-6 py-3 text-md font-bold text-slate-600 uppercase tracking-wider">
                  No. HP
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {adminListQuery.isLoading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center text-slate-500">
                    Memuat daftar admin...
                  </td>
                </tr>
              ) : adminListQuery.isError ? (
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center text-red-600">
                    Gagal load admin. Cek endpoint GET /admin-apk
                  </td>
                </tr>
              ) : adminRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-10 text-center text-slate-500">
                    Belum ada admin APK.
                  </td>
                </tr>
              ) : (
                adminRows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="text-[16px] font-semibold text-slate-800">{a.nama}</div>
                      <div className="text-[13px] text-slate-500">{a.email}</div>
                    </td>

                    <td className="text-[16px] font-semibold px-6 py-4 text-slate-600">{a.nik}</td>

                    <td className="text-[16px] font-semibold px-6 py-4 text-slate-600">{a.no_hp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH ADMIN APK */}
      {showAddModal && (
        <AddAdminApkModal
          onClose={() => setShowAddModal(false)}
          adminApkForm={adminApkForm}
          setField={setField}
          adminApkErrors={adminApkErrors}
          setAdminApkErrors={setAdminApkErrors}
          adminApkLoading={adminApkLoading}
          adminApkResult={adminApkResult}
          onSubmitAdminApk={submitAdminApk}
          noHpHint={noHpHint}
          setNoHpHint={setNoHpHint}
          sanitizePhone={sanitizePhone}
          isForbiddenLandline021={isForbiddenLandline021}
        />
      )}
    </div>
  );
}

/* =========================
  MODAL COMPONENT
========================= */
function AddAdminApkModal({
  onClose,
  adminApkForm,
  setField,
  adminApkErrors,
  setAdminApkErrors,
  adminApkLoading,
  adminApkResult,
  onSubmitAdminApk,
  noHpHint,
  setNoHpHint,
  sanitizePhone,
  isForbiddenLandline021,
}) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"> 
      {/* overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed h-full w-full flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:account-plus" className="text-blue-600" width={24} />
              Tambah Admin APK
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
              aria-label="Close modal"
              type="button"
            >
              <Icon icon="mdi:close" width={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {adminApkErrors?.general?.[0] && (
              <p className="text-xs text-red-600">{adminApkErrors.general[0]}</p>
            )}

            {/* ✅ CUMA NAMA */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="Nama admin"
                value={adminApkForm?.nama ?? ""}
                onChange={(e) => setField("nama", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {adminApkErrors?.nama?.[0] && (
                <p className="text-xs text-red-600">{adminApkErrors.nama[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                NIK <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Masukkan NIK"
                value={adminApkForm?.nik ?? ""}
                onChange={(e) => {
                  // hanya angka, max 16 digit
                  const value = e.target.value.replace(/\D/g, "").slice(0, 16);
                  setField("nik", value);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {adminApkErrors?.nik?.[0] && (
                <p className="text-xs text-red-600">{adminApkErrors.nik[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                No. HP  <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                inputMode="tel"
                placeholder="Masukkan nomor HP"
                value={adminApkForm?.no_hp ?? ""}
                onChange={(e) => {
                  const cleaned = sanitizePhone(e.target.value);
                  const digitsOnly = cleaned.replace(/\D/g, "");

                  // ✅ batasi digit 13 (yang dihitung angka doang)
                  if (digitsOnly.length > 13) {
                    setNoHpHint("Maksimal 13 digit angka.");
                    // taro pesannya di bawah input (bukan di label)
                    setAdminApkErrors((prev) => ({ ...prev, no_hp: ["Maksimal 13 digit angka."] }));
                    return;
                  }

                  setField("no_hp", cleaned);

                  // ✅ 021 ditolak
                  if (isForbiddenLandline021(cleaned)) {
                    setNoHpHint("Nomor tidak boleh diawali 021 (telepon rumah).");
                    setAdminApkErrors((prev) => ({ ...prev, no_hp: ["Nomor tidak valid. Gunakan nomor HP (bukan 021)."] }));
                    return;
                  }

                  // ✅ minimum 10 digit (kalau masih ngetik -> boleh kamu pilih mau muncul atau engga)
                  if (digitsOnly.length > 0 && digitsOnly.length < 10) {
                    setNoHpHint("Minimal 10 digit angka.");
                    setAdminApkErrors((prev) => ({ ...prev, no_hp: ["Minimal 10 digit angka."] }));
                    return;
                  }

                  // ✅ valid -> bersihin hint & error no_hp
                  setNoHpHint("");
                  setAdminApkErrors((prev) => {
                    if (!prev?.no_hp) return prev;
                    const copy = { ...prev };
                    delete copy.no_hp;
                    return copy;
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {adminApkErrors?.no_hp?.[0] && (
                <p className="mt-1 text-xs text-red-600">{adminApkErrors.no_hp[0]}</p>
              )}
            </div>

            {/* (optional) success card tetap ada, karena lu udah punya result dari backend */}
            {adminApkResult?.email && adminApkResult?.password && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <Icon icon="mdi:check-circle" width={18} />
                  Credential berhasil dibuat
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  <div>
                    Email: <span className="font-semibold">{adminApkResult.email}</span>
                  </div>
                  <div>
                    Password: <span className="font-semibold">{adminApkResult.password}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
              type="button"
            >
              Batal
            </button>
            <button
              onClick={() => onSubmitAdminApk?.()}
              disabled={adminApkLoading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
              type="button"
            >
              {adminApkLoading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
