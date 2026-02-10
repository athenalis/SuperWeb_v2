import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import api from "../../lib/axios";

/**
 * Manajemen Kurir APK (Alat Peraga Kampanye)
 * - Hanya untuk role admin_apk
 * - CRUD Kurir APK
 * - Tanpa fitur pengiriman
 */

export default function KurirApkIndex() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [showModal, setShowModal] = useState(false);
  const [editingKurir, setEditingKurir] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nama: "",
    no_hp: "",
  });

  // Fetch kurir list
  const { data: kurirData, isLoading, isError } = useQuery({
    queryKey: ["kurir-apk", searchTerm, filterStatus],
    queryFn: async () => {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterStatus !== "Semua") params.status = filterStatus.toLowerCase();
      const res = await api.get("/apk-kurir", { params });
      return res.data;
    },
  });

  const kurirList = kurirData?.data || [];

  // Stats
  const totalKurir = kurirList.length;
  const kurirAktif = kurirList.filter((k) => k.status === "active").length;
  const totalPengiriman = kurirList.reduce(
    (sum, k) => sum + (k.total_pengiriman || 0),
    0
  );
  const pengirimanSelesai = kurirList.reduce(
    (sum, k) => sum + (k.pengiriman_selesai || 0),
    0
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/apk-kurir", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["apk-kurir"]);
      toast.success("Kurir berhasil ditambahkan!");

      // Show credentials if available
      if (res.data?.data?.user) {
        const { email, password } = res.data.data.user;
        toast.success(
          <div className="text-sm">
            <p className="font-bold mb-1">Kredensial Login:</p>
            <p>Email: {email}</p>
            <p>Password: {password}</p>
          </div>,
          { duration: 10000 }
        );
      }

      resetForm();
    },
    onError: (err) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.nama?.[0] ||
        "Gagal menambahkan kurir";
      toast.error(msg);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/apk-kurir/${id}`, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries(["kurir-apk"]);
      toast.success("Kurir berhasil diperbarui!");

      // Show new credentials if name changed
      if (res.data?.data?.user) {
        const { email, password } = res.data.data.user;
        toast.success(
          <div className="text-sm">
            <p className="font-bold mb-1">Kredensial Baru:</p>
            <p>Email: {email}</p>
            <p>Password: {password}</p>
          </div>,
          { duration: 10000 }
        );
      }

      resetForm();
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "Gagal memperbarui kurir";
      toast.error(msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/apk-kurir/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["kurir-apk"]);
      toast.success("Kurir berhasil dihapus!");
      setDeleteConfirm(null);
    },
    onError: (err) => {
      const msg = err.response?.data?.message || "Gagal menghapus kurir";
      toast.error(msg);
    },
  });

  const resetForm = () => {
    setFormData({ nama: "", no_hp: "" });
    setEditingKurir(null);
    setShowModal(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // validasi nama: gak boleh ada angka (harusnya sudah kebuang, tapi jaga-jaga)
    if (/\d/.test(formData.nama)) {
    return toast.error("Nama kurir tidak boleh mengandung angka");
    }

    // validasi no hp: prefix + panjang digit
    if (!isValidPhoneFinal(formData.no_hp)) {
    return toast.error("No. HP harus diawali 08 / 62 / +62 dan panjang 10–13 digit");
    }

    if (!formData.nama.trim()) {
      return toast.error("Nama kurir wajib diisi");
    }
    if (!formData.no_hp.trim()) {
      return toast.error("No. HP wajib diisi");
    }

    if (editingKurir) {
      updateMutation.mutate({
        id: editingKurir.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (kurir) => {
    setEditingKurir(kurir);
    setFormData({
      nama: kurir.nama || "",
      no_hp: kurir.no_hp || "",
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold",
      inactive: "bg-rose-100 text-rose-700 border border-rose-200 font-bold",
    };
    return styles[status] || "bg-slate-100 text-slate-600 border border-slate-200 font-bold";
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: "Aktif",
      inactive: "Tidak Aktif",
    };
    return labels[status] || status;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const words = name.trim().split(" ");
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-cyan-500",
    ];
    const idx = (name || "").charCodeAt(0) % colors.length;
    return colors[idx];
  };

  // === INPUT NORMALIZER ===
const normalizeNama = (val) => {
  // buang angka, rapihin spasi, tapi tetep boleh huruf + spasi + titik + apostrophe + strip
  return (val || "")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, " ")
    .trimStart(); // biar user masih bisa ngetik lanjut
};

const normalizePhone = (val) => {
  // keep digit + "+"
  let v = (val || "").replace(/[^\d+]/g, "");

  // cuma boleh "+" di depan
  if (v.includes("+")) {
    v = v.replace(/\+/g, "");
    v = `+${v}`;
  }

  // kalau user ngetik "+62xxxx" -> simpan as +62 + digits
  if (v.startsWith("+62")) {
    const digits = v.replace(/\D/g, ""); // 62xxxx
    return "+62" + digits.slice(2, 13 + 2); // max 13 digit setelah prefix (total digit = 15 termasuk 62)
  }

  // selain +62, enforce hanya digit
  v = v.replace(/\D/g, "");

  // kalau mulai 62...
  if (v.startsWith("62")) {
    return "62" + v.slice(2, 13 + 2); // max 13 digit setelah prefix
  }

  // kalau mulai 08...
  if (v.startsWith("08")) {
    return "08" + v.slice(2, 13); // max 13 digit total
  }

  // kalau user baru ngetik awal (misal "0" atau "6" atau "+") biarin dulu supaya bisa lanjut ngetik
  if (v === "" || v === "0" || v === "6" || v === "62") return v;

  // default: balikin apa adanya (nanti divalidasi saat submit)
  return v.slice(0, 13);
};

const isValidPhoneFinal = (val) => {
  const raw = (val || "").trim();

  // bentuk yang boleh: 08xxxxxxxxxx / 62xxxxxxxxxx / +62xxxxxxxxxx
  const withoutPlus = raw.startsWith("+") ? raw.slice(1) : raw;
  const onlyDigits = withoutPlus.replace(/\D/g, "");

  let digitsAfterPrefix = "";
  if (raw.startsWith("08")) {
    digitsAfterPrefix = raw.slice(2).replace(/\D/g, "");
  } else if (raw.startsWith("+62")) {
    digitsAfterPrefix = raw.slice(3).replace(/\D/g, "");
  } else if (raw.startsWith("62")) {
    digitsAfterPrefix = raw.slice(2).replace(/\D/g, "");
  } else {
    return false;
  }

  // total digit nomor (tanpa +) harus 10-13 digit
  // contoh 08 + 8..11 digit = 10..13
  const totalDigitsNoPlus = onlyDigits.length;
  if (totalDigitsNoPlus < 10 || totalDigitsNoPlus > 13) return false;

  // prefix wajib bener, sisanya digit aja
  return /^\+?(\d+)$/.test(raw.replace(/\s/g, ""));
};

const handleNamaChange = (e) => {
  const cleaned = normalizeNama(e.target.value);
  setFormData((prev) => ({ ...prev, nama: cleaned }));
};

const handlePhoneChange = (e) => {
  const cleaned = normalizePhone(e.target.value);
  setFormData((prev) => ({ ...prev, no_hp: cleaned }));
};

  const closeExportModal = () => {
    setShowPasswordModal(false);
    setExportPassword("");
    setShowExportPassword(false);
    setExporting(false);
  };

  const handleConfirmExport = async () => {
    if (!exportPassword) return toast.error("Masukkan password terlebih dahulu");

    const toastId = "export-kurir-apk";
    try {
      setExporting(true);
      toast.loading("Menyiapkan file Excel...", { id: toastId });

      const res = await api.post(
        "/apk-kurir/export",
        { password: exportPassword },
        {
          responseType: "blob",
          validateStatus: (status) => status < 500,
        }
      );

      // kalau backend kirim JSON error, baca dulu supaya toast errornya jelas
      const contentType = res.headers["content-type"];
      if (contentType?.includes("application/json")) {
        const text = await res.data.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
        throw new Error(data?.message || "Export gagal");
      }

      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;

      const filename =
        res.headers["content-disposition"]
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "kurir_apk.xlsx";

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Export berhasil", { id: toastId });
      closeExportModal();
    } catch (err) {
      toast.error(err?.message || "Gagal export", { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* ================= HEADER (samain koordinator) ================= */}
        <div className="bg-white rounded-lg p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">
              Manajemen Kurir APK
            </h1>
            <p className="text-slate-500 mt-1">
              Kelola kurir alat peraga kampanye
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="bg-blue-500/15 text-blue-800 border border-blue-200/40 px-4 py-2 rounded-lg hover:bg-blue-500/25 flex items-center gap-2"
            >
              <Icon icon="mdi:file-excel-outline" width={20} />
              Export Data Kurir
            </button>

            <button
              onClick={openCreateModal}
              className="bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-blue-800 flex items-center gap-2"
            >
              <Icon icon="mdi:account-plus" width={20} />
              Tambah Kurir
            </button>
          </div>
        </div>

        {/* ================= STATS (dibikin card style koordinator) ================= */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total Kurir</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{totalKurir}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:account-group" width={24} className="text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Kurir Aktif</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{kurirAktif}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:account-check" width={24} className="text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total Pengiriman</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{totalPengiriman}</p>
                </div>
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:package-variant" width={24} className="text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Pengiriman Selesai</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{pengirimanSelesai}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Icon icon="mdi:check-circle" width={24} className="text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= FILTER SECTION (samain koordinator style) ================= */}
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Icon icon="mdi:filter-variant" className="text-blue-700" width="28" />
            <div>
              <div className="text-lg font-semibold">Filter Data</div>
              <div className="text-sm text-slate-400">
                Cari data berdasarkan Nama/Email dan Status
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search */}
            <div className="md:col-span-6 relative group">
              <Icon
                icon="mdi:magnify"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors"
                width="24"
              />
              <input
                type="text"
                placeholder="Cari kurir..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-400 pl-12 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              />
            </div>

            {/* Status filter dropdown */}
            <div className="md:col-span-6 relative group">
              <Icon
                icon="mdi:chevron-down"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors"
                width="22"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 ${
                  filterStatus ? "text-slate-800" : "text-slate-400"
                }`}
              >
                <option value="Semua">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>
          </div>
        </div>

        {/* ================= TABLE (samain koordinator: wrapper + empty states + mobile/desktop) ================= */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {/* MOBILE CARD VIEW */}
          <div className="md:hidden space-y-4 px-4 pb-4">
            {isLoading && <div className="text-center py-6">Loading...</div>}
            {isError && (
              <div className="text-center py-6 text-red-600">Gagal memuat data</div>
            )}
            {!isLoading && !isError && kurirList.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                <Icon icon="mdi:account-off-outline" width={36} className="mx-auto mb-2" />
                <p className="font-medium">Data belum tersedia</p>
                <p className="text-sm opacity-70">
                  Belum ada data kurir yang bisa ditampilkan
                </p>
              </div>
            )}

            {!isLoading &&
              !isError &&
              kurirList.map((kurir) => (
                <div
                  key={kurir.id}
                  className="bg-white border rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="font-medium text-slate-800">{kurir.nama}</p>
                        {kurir.user?.email && (
                            <p className="text-xs text-slate-500">{kurir.user.email}</p>
                        )}
                    </div>

                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ml-2 ${getStatusBadge(
                        kurir.status
                      )}`}
                    >
                      {getStatusLabel(kurir.status)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon
                        icon="mdi:phone-outline"
                        width={16}
                        className="text-gray-400 shrink-0"
                      />
                      <span>{kurir.no_hp}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Icon
                        icon="mdi:package-variant"
                        width={16}
                        className="text-gray-400 shrink-0"
                      />
                      <span>
                        Total pengiriman:{" "}
                        <b className="text-slate-800">{kurir.total_pengiriman || 0}</b>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Icon
                        icon="mdi:check-circle-outline"
                        width={16}
                        className="text-gray-400 shrink-0"
                      />
                      <span>
                        Selesai:{" "}
                        <b className="text-emerald-700">{kurir.pengiriman_selesai || 0} </b>
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(kurir)}
                      className="flex-1 bg-blue-100 hover:bg-blue-100 text-blue-700 py-2.5 rounded-lg flex items-center justify-center transition-colors"
                      title="Edit"
                    >
                      <Icon icon="proicons:pencil" width={20} />
                      <span className="ml-2 text-xs font-bold">Edit</span>
                    </button>

                    <button
                      onClick={() => setDeleteConfirm(kurir)}
                      className="flex-1 bg-red-100 hover:bg-red-100 text-red-700 py-2.5 rounded-lg flex items-center justify-center transition-colors"
                      title="Hapus"
                    >
                      <Icon icon="solar:trash-bin-trash-outline" width={20} />
                      <span className="ml-2 text-xs font-bold">Hapus</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* DESKTOP TABLE VIEW */}
          <table className="w-full text-base hidden md:table">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-5 py-4 text-left">Kurir</th>
                <th className="px-5 py-4 text-left">No. HP</th>
                <th className="px-5 py-4 text-center">Total Pengiriman</th>
                <th className="px-5 py-4 text-center">Selesai</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="6" className="py-6 text-center">
                    Loading...
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-red-600">
                    Gagal memuat data
                  </td>
                </tr>
              )}

              {!isLoading && !isError && kurirList.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2 opacity-60">
                      <Icon icon="mdi:account-off-outline" width={48} />
                      <p className="font-semibold text-lg">Data belum tersedia</p>
                      <p className="text-sm">Belum ada data kurir yang dapat ditampilkan.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                kurirList.map((kurir) => (
                  <tr
                    key={kurir.id}
                    className="border-t hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                     <div>
                        <h3 className="font-semibold text-gray-900">{kurir.nama}</h3>
                        {kurir.user?.email && (
                            <p className="text-sm text-gray-500">{kurir.user.email}</p>
                        )}
                    </div>
                    </td>

                    <td className="px-5 py-4 text-slate-600">{kurir.no_hp}</td>

                    <td className="px-5 py-4 text-center font-bold text-slate-800">
                      {kurir.total_pengiriman || 0}
                    </td>

                    <td className="px-5 py-4 text-center font-bold text-emerald-600">
                      {kurir.pengiriman_selesai || 0}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-block min-w-[100px] px-4 py-1.5 rounded-full text-xs font-bold ${getStatusBadge(
                          kurir.status
                        )}`}
                      >
                        {getStatusLabel(kurir.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(kurir)}
                          title="Edit"
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-blue-600 border border-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                        >
                          <Icon icon="proicons:pencil" width={18} />
                        </button>

                        <button
                          onClick={() => setDeleteConfirm(kurir)}
                          title="Hapus"
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 border border-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm"
                        >
                          <Icon icon="solar:trash-bin-trash-outline" width={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ================= CREATE/EDIT MODAL ================= */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-0 z-10 border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                  {editingKurir ? "Edit Kurir" : "Tambah Kurir Baru"}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
                >
                  <Icon icon="mdi:close" width={22} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                  {/* Nama Kurir */}
                  <div>
                    <label className="block text-md font-semibold text-slate-800 mb-1">
                      Nama Kurir <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan nama kurir"
                      value={formData.nama}
                      onChange={handleNamaChange}
                      className="w-full border border-gray-400 px-4 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
                    />
                  </div>

                  {/* Telepon */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      No. HP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="08xxxxxxxxxx"
                      value={formData.no_hp}
                      onChange={handlePhoneChange}
                      className="w-full border border-gray-400 px-4 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="px-5 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Icon icon="mdi:loading" className="animate-spin" width={18} />
                    )}
                    {editingKurir ? "Simpan" : "Tambah"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= DELETE CONFIRMATION MODAL ================= */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 z-10 border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Hapus Kurir
              </h2>
              <p className="text-slate-600 mb-6">
                Yakin ingin menghapus kurir{" "}
                <span className="font-semibold text-slate-800">
                  “{deleteConfirm.nama}”
                </span>
                ?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>

                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleteMutation.isPending && (
                    <Icon icon="mdi:loading" className="animate-spin" width={18} />
                  )}
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeExportModal}
          />

          <div className="relative bg-white w-full max-w-md rounded-2xl p-6 z-10 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-800 mb-5">
              Konfirmasi Password
            </h2>

            {/* ===== FAKE EMAIL (ANTI AUTOFILL) ===== */}
            <input
              type="email"
              name="email"
              autoComplete="email"
              tabIndex={-1}
              className="absolute -left-[9999px] opacity-0 pointer-events-none"
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              className="absolute -left-[9999px] opacity-0 pointer-events-none"
            />

            <div className="relative mb-6">
              <Icon
                icon="mdi:lock-outline"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                width={22}
              />

              <input
                type={showExportPassword ? "text" : "password"}
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Password akun"
                className="w-full border rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() => setShowExportPassword(!showExportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                <Icon
                  icon={showExportPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"}
                  width="22"
                />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={closeExportModal}
                disabled={exporting}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleConfirmExport}
                disabled={!exportPassword || exporting}
                className={`w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition ${
                  exporting || !exportPassword ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {exporting ? "Memproses..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
