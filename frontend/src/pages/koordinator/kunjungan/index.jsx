import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import api from "../../../lib/axios";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

export default function Koordinator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openImport, setOpenImport] = useState(false);
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteError, setDeleteError] = useState(null);


  // ================= PAGINATION (TAMBAHAN) =================
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  // ================= WILAYAH =================
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  // ================= FILTER =================
  const [filters, setFilters] = useState({
    keyword: "",
    city_code: "",
    district_code: "",
    village_code: "",
  });

  const [activeFilters, setActiveFilters] = useState({});

  // Load Cities
  useEffect(() => {
    api.get("/wilayah/cities/31").then((res) => setCities(res.data));
  }, []);

  const loadDistricts = async (cityCode) => {
    if (!cityCode) {
      setDistricts([]);
      return;
    }
    const res = await api.get(`/wilayah/districts/${cityCode}`);
    setDistricts(res.data.data ?? res.data);
  };

  const loadVillages = async (districtCode) => {
    if (!districtCode) {
      setVillages([]);
      return;
    }
    const res = await api.get(`/wilayah/villages/${districtCode}`);
    setVillages(res.data.data ?? res.data);
  };

  // ================= FETCH =================
  const fetchKoordinators = async () => {
    const res = await api.get("/koordinator", {
      params: {
        city_code: activeFilters.city_code,
        district_code: activeFilters.district_code,
        village_code: activeFilters.village_code,
      },
    });
    // Handle both paginated and non-paginated
    const result = res.data.data;
    if (Array.isArray(result)) return result;
    return result?.data || [];
  };

  const {
    data: koordinators = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["koordinators", activeFilters],
    queryFn: fetchKoordinators,
  });

  // reset page saat data berubah
  useEffect(() => {
    setPage(1);
  }, [perPage, koordinators, filters.nama, filters.nik, filters.tps]);

  const matchNama = (nama, keyword) => {
    if (!keyword) return true;
    return nama.toLowerCase().includes(keyword.toLowerCase().trim());
  };

  const matchNik = (nik, keyword) => {
    if (!keyword) return true;
    return String(nik).includes(keyword.trim());
  };

  const matchTps = (tps, keyword) => {
    if (!keyword) return true;
    const normalize = (val) => String(val).replace(/^0+/, "");
    return normalize(tps) === normalize(keyword);
  };

  const semanticFiltered = koordinators.filter((item) => {
    const s = filters.keyword.toLowerCase().trim();
    if (!s) return true; // Jika kosong, tampilkan semua

    const matchNama = (item.nama ?? "").toLowerCase().includes(s);
    const matchNik = String(item.nik ?? "").includes(s);

    // Normalisasi TPS (buang angka 0 di depan agar '001' match dengan '1')
    const normalize = (val) => String(val).replace(/^0+/, "");
    const matchTps = normalize(item.tps ?? "") === normalize(s);

    // Return true jika salah satu kolom cocok (Logika OR)
    return matchNama || matchNik || matchTps;
  });

  const totalPage = Math.ceil(semanticFiltered.length / perPage);

  const paginatedData = semanticFiltered.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const pages = Array.from({ length: totalPage }, (_, i) => i + 1);

  // ================= FILTER ACTION =================
  const applyFilter = () => {
    setActiveFilters({
      city_code: filters.city_code,
      district_code: filters.district_code,
      village_code: filters.village_code,
    });
  };

  const resetFilter = () => {
    setFilters({
      keyword: "",
      city_code: "",
      district_code: "",
      village_code: "",
    });
    setActiveFilters({});
    setDistricts([]);
    setVillages([]);
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/koordinator/template", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", "template_koordinator.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Gagal mengunduh template");
    }
  };


  // ================= EXPORT =================
  const exportAllKoordinators = async () => {
    if (!exportPassword) {
      toast.error("Masukkan password terlebih dahulu");
      return;
    }

    const toastId = "export-koordinator";

    try {
      setExporting(true);
      toast.loading("Menyiapkan file Excel...", { id: toastId });

      const res = await api.post(
        "/koordinator/export",
        { password: exportPassword },
        {
          responseType: "blob",
          validateStatus: (status) => status < 500, // ⬅️ INI KUNCI UTAMA
        }
      );

      // 🧠 cek apakah ini file excel atau pesan error JSON
      const contentType = res.headers["content-type"];

      if (contentType?.includes("application/json")) {
        const text = await res.data.text();
        const data = JSON.parse(text);
        throw new Error(data.message || "Export gagal");
      }

      // ✅ DOWNLOAD FILE
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "koordinator_all.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Export berhasil", { id: toastId });

      setOpenExportModal(false);
      setExportPassword("");
      setShowPassword(false);

    } catch (err) {
      toast.error(err.message || "Gagal export", { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // ================= IMPORT =================
  const importKoordinator = async () => {
    if (!file) {
      alert("Pilih file terlebih dahulu");
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/koordinator/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setImportResult(res.data.data);
      refetch();

      const successCount = res.data.data?.successCount ?? 0;
      if (successCount > 0) {
        alert(`Berhasil menambahkan ${successCount} koordinator!`);
        closeImportModal();
      }
    } catch {
      alert("Gagal import data");
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setOpenImport(false);
    setFile(null);
    setImportResult(null);
  };

  // ================= DELETE =================
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/koordinator/${id}`),

    onMutate: () => {
      setDeleteError(null);
      toast.loading("Menghapus koordinator...", { id: "delete-koor" });
    },

    onSuccess: () => {
      queryClient.invalidateQueries(["koordinators"]);
      toast.success("Koordinator berhasil dihapus", { id: "delete-koor" });
      setDeleteTarget(null);
    },

    onError: (err) => {
      toast.dismiss("delete-koor");

      if (err.response?.status === 422) {
        setDeleteError(err.response.data.message);
      } else {
        toast.error("Gagal menghapus koordinator");
      }
    },
  });

  return (
    <div className="space-y-6">

      {/* ================= HEADER ================= */}
      <div className="bg-white rounded-lg p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold text-blue-900">Data Koordinator Kunjungan</h1>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setOpenImport(true)}
            className="bg-blue-500/15 text-blue-800 border border-blue-200/40 px-4 py-2 rounded-lg hover:bg-blue-500/25"
          >
            Import Data Koordinator
          </button>

          <button
            onClick={() => navigate("/koordinator/kunjungan/create")}
            className="bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-blue-800"
          >
            Tambah Koordinator +
          </button>
        </div>
      </div>

      {/* ================= FILTER SECTION  ================= */}
      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        {/* Header Filter */}
        <div className="flex items-center gap-3">
          <Icon icon="mdi:filter-variant" className="text-blue-700" width="28" />
          <div>
            <div className="text-lg font-semibold">Filter Data</div>
            <div className="text-sm text-slate-400">
              Cari data berdasarkan Nama, NIK, TPS, atau Wilayah
            </div>
          </div>
        </div>

        {/* Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* SEARCH BOX GABUNGAN (Span 4 cols di desktop) */}
          <div className="md:col-span-4 relative group">
            <Icon
              icon="mdi:magnify"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors"
              width="24"
            />
            <input
              className="w-full border border-gray-400 pl-12 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              placeholder="Cari Nama / NIK / TPS"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>

          {/* REGION FILTERS (Span 8 cols di desktop) */}
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* KOTA */}
            <div className="relative group">
              <Icon
                icon="mdi:chevron-down"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors"
                width="22"
              />
              <select
                className={`w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 ${filters.city_code ? "text-slate-800" : "text-slate-400"}`}
                value={filters.city_code}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({ ...filters, city_code: val, district_code: "", village_code: "" });
                  loadDistricts(val);
                }}
              >
                <option value="">Pilih Kota/Kabupaten</option>
                {cities.map((c) => (<option key={c.city_code} value={c.city_code}>{c.city}</option>))}
              </select>
            </div>

            {/* KECAMATAN */}
            <div className="relative group">
              <Icon
                icon="mdi:chevron-down"
                className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${!filters.city_code ? "text-gray-200" : "text-slate-400 group-focus-within:text-blue-600"}`}
                width="22"
              />
              <select
                className="w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 disabled:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200"
                value={filters.district_code}
                disabled={!filters.city_code}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({ ...filters, district_code: val, village_code: "" });
                  loadVillages(val);
                }}
              >
                <option value="">Pilih Kecamatan</option>
                {districts.map((d) => (<option key={d.district_code} value={d.district_code}>{d.district}</option>))}
              </select>
            </div>

            {/* KELURAHAN */}
            <div className="relative group">
              <Icon
                icon="mdi:chevron-down"
                className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${!filters.district_code ? "text-gray-200" : "text-slate-400 group-focus-within:text-blue-600"}`}
                width="22"
              />
              <select
                className="w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 disabled:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200"
                value={filters.village_code}
                disabled={!filters.district_code}
                onChange={(e) => setFilters({ ...filters, village_code: e.target.value })}
              >
                <option value="">Pilih Kelurahan</option>
                {villages.map((v) => (<option key={v.village_code} value={v.village_code}>{v.village}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* BUTTON ACTION */}
        <div className="flex justify-end gap-3">
          <button
            className="bg-blue-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-800 transition"
            onClick={applyFilter}
          >
            <Icon icon="mdi:filter-variant" width={20} />
          </button>

          <button
            onClick={resetFilter}
            className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg hover:bg-blue-200 transition border border-blue-200"
          >
            <Icon icon="mdi:refresh" width={20} />
          </button>

          <div className="flex-1 md:flex-none" /> {/* Spacer */}

          <button
            onClick={() => setOpenExportModal(true)}
            disabled={exporting}
            className={`bg-blue-100 text-blue-800 px-6 py-2.5 rounded-lg border border-blue-200 font-bold transition flex items-center gap-2  
                ${exporting ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-200"}
              `}>

            {exporting ? "Sedang Mengunduh..." : "Export Akun"}


          </button>
        </div>
      </div>

      {/* PER PAGE */}
      <div className="flex items-center gap-2 text-sm mt-4 text-slate-500">
        <span>Tampilkan</span>
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          className="border border-slate-300 rounded-lg px-3 py-1 "
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <span>data per halaman</span>
      </div>


      {/* ================= TABLE ================= */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {/* ================= MOBILE CARD VIEW (< md) ================= */}
        <div className="md:hidden space-y-4 px-4 pb-4">
          {isLoading && <div className="text-center py-6">Loading...</div>}
          {isError && <div className="text-center py-6 text-red-600">Gagal memuat data</div>}
          {!isLoading && !isError && paginatedData.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              <Icon
                icon="mdi:database-off-outline"
                width={36}
                className="mx-auto mb-2"
              />
              <p className="font-medium">Data belum tersedia</p>
              <p className="text-sm opacity-70">
                Belum ada data koordinator yang bisa ditampilkan
              </p>
            </div>
          )}

          {!isLoading && !isError && paginatedData.map((item) => (
            <div key={item.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.nama}</h3>
                  <p className="text-sm text-gray-500">{item.nik}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ml-2 ${item.status === "active" ? "bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold" : "bg-rose-100 text-rose-700 border border-rose-200 font-bold "}`}>
                  {item.status === "active" ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:map-marker-outline" width={16} className="text-gray-400 shrink-0" />
                  <span>{item.village?.village || "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:office-building-marker-outline" width={16} className="text-gray-400 shrink-0" />
                  <span>TPS {item.tps}</span>
                </div>
                {item.no_hp && (
                  <div className="flex items-center gap-2">
                    <Icon icon="mdi:phone-outline" width={16} className="text-gray-400 shrink-0" />
                    <span>{item.no_hp}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex items-center gap-2">
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="flex-1 bg-red-100 hover:bg-red-100 text-red-700 py-2.5 rounded-lg flex items-center justify-center transition-colors"
                  title="Hapus"
                >
                  <Icon icon="solar:trash-bin-trash-outline" width={20} />
                  <span className="ml-2 text-xs font-bold">Hapus</span>
                </button>
                <button
                  onClick={() => navigate(`/koordinator/kunjungan/${item.id}`)}
                  className="flex-1 bg-blue-100 hover:bg-blue-100 text-blue-700 py-2.5 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Icon icon="si:eye-line" width={20} />
                  <span className="ml-2 text-xs font-bold">Detail</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ================= DESKTOP TABLE VIEW (>= md) ================= */}
        <table className="w-full text-base hidden md:table">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-5 py-4 text-left">Nama</th>
              <th className="px-5 py-4 text-left hidden md:table-cell">NIK</th>
              <th className="px-5 py-4 text-left hidden md:table-cell">Wilayah</th>
              <th className="px-5 py-4 text-left hidden md:table-cell">No. HP</th>
              <th className="px-5 py-4 text-center hidden md:table-cell">TPS</th> {/* Center */}
              <th className="px-5 py-4 text-center hidden md:table-cell">Status</th> {/* Center */}
              <th className="px-5 py-4 text-center">Aksi</th> {/* Center */}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan="7" className="py-6 text-center">Loading...</td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan="7" className="py-6 text-center text-red-600">
                  Gagal memuat data
                </td>
              </tr>
            )}
            {!isLoading && !isError && paginatedData.length === 0 && (
              <tr>
                <td colSpan="7" className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2 opacity-60">
                    <Icon icon="mdi:database-off-outline" width={48} />
                    <p className="font-semibold text-lg">Data belum tersedia</p>
                    <p className="text-sm">
                      Belum ada data koordinator yang dapat ditampilkan.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && paginatedData.map((item) => (
              <tr key={item.id} className="border-t hover:bg-blue-50/50 transition-colors">
                <td className="px-5 py-4 font-medium text-slate-800">{item.nama}</td>
                <td className="px-5 py-4 hidden md:table-cell text-slate-600">{item.nik}</td>
                <td className="px-5 py-4 hidden md:table-cell text-slate-600">
                  {item.village?.village || "-"}
                </td>
                <td className="px-5 py-4 hidden md:table-cell text-slate-600">{item.no_hp}</td>
                <td className="px-5 py-4 hidden md:table-cell text-center font-semibold text-slate-700">
                  {item.tps}
                </td>

                {/* STATUS: Dibuat Center */}
                <td className="px-5 py-4 hidden md:table-cell text-center">
                  <span
                    className={`inline-block min-w-[100px] px-4 py-1.5 rounded-full text-xs font-bold ${item.status === "active"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold "
                        : "bg-rose-100 text-rose-700 border border-rose-200 font-bold "
                      }`}
                  >
                    {item.status === "active" ? "Aktif" : "Tidak Aktif"}
                  </span>
                </td>

                {/* AKSI: Dibuat Center */}
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-2">
                    {/* TOMBOL DETAIL (Mata) */}
                    <button
                      onClick={() => navigate(`/koordinator/kunjungan/${item.id}`)}
                      title="Detail"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-blue-600 border border-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                    >
                      <Icon icon="si:eye-line" width={18} />
                    </button>

                    {/* TOMBOL HAPUS (Sampah) */}
                    <button
                      onClick={() => setDeleteTarget(item)}
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
        {/* ================= PAGINATION ================= */}
        {!isLoading && !isError && paginatedData.length > 0 && (
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center justify-center sm:justify-start">
              <div className="text-sm text-slate-500">
                Halaman {page} dari {totalPage}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border rounded-lg disabled:opacity-50"
              >
                Sebelumnya
              </button>

              {pages.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg border ${p === page
                      ? "bg-blue-900 text-white border-blue-900"
                      : "hover:bg-slate-100"
                    }`}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={page === totalPage}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border rounded-lg disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL DELETE ================= */}
      {deleteTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* BACKDROP */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />

            {/* MODAL */}
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Hapus Koordinator
              </h2>

              {/* ===== JIKA MASIH PUNYA RELAWAN ===== */}
              {deleteTarget.relawans_count > 0 ? (
                <div className="text-slate-700">
                  <p className="mb-4">
                    Koordinator
                    <span className="font-semibold">
                      {" "}“{deleteTarget.nama}”{" "}
                    </span>
                    masih mempunyai
                    <span className="font-semibold text-red-600">
                      {" "}{deleteTarget.relawans_count}{" "}
                    </span>
                    relawan.
                  </p>

                  <p className="text-sm text-slate-500">
                    Tolong hapus relawan terlebih dahulu sebelum menghapus koordinator.
                  </p>

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300
                           text-slate-600 hover:bg-slate-100 transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                /* ===== JIKA TIDAK PUNYA RELAWAN ===== */
                <>
                  <p className="text-slate-600 mb-6">
                    Yakin ingin menghapus koordinator
                    <span className="font-semibold text-slate-800">
                      {" "}“{deleteTarget.nama}”
                    </span>
                    ?
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300
                           text-slate-600 hover:bg-slate-100 transition"
                    >
                      Batal
                    </button>

                    <button
                      onClick={() => {
                        deleteMutation.mutate(deleteTarget.id);
                        setDeleteTarget(null);
                      }}
                      className="px-5 py-2 rounded-lg bg-red-600 text-white
                           hover:bg-red-700 transition"
                    >
                      Hapus
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.getElementById("modal-root")
        )
      }

      {/* ================= MODAL IMPORT ================= */}
      {openImport &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeImportModal}
            />

            <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 z-10">
              <button
                onClick={closeImportModal}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <Icon icon="mdi:close" width="22" />
              </button>

              <h2 className="text-3xl text-blue-900 font-semibold mb-2">
                Import Data Koordinator
              </h2>

              <ol className="list-decimal list-inside text-md text-slate-600 space-y-1 mb-5">
                <li>Download template Excel</li>
                <li>Isi data sesuai format</li>
                <li>Upload file lalu klik Import</li>
              </ol>

              <button
                className="w-full border border-blue-600 text-blue-600
                py-2.5 rounded-lg mb-7 hover:bg-blue-50"
                onClick={downloadTemplate}
              >
                Download Template Excel
              </button>

              <label className="text-md font-medium mb-2 block">
                Upload File Excel
              </label>

              <input
                type="file"
                accept=".xls,.xlsx"
                className="w-full border rounded-lg px-4 py-2 text-sm mb-4"
                onChange={(e) => setFile(e.target.files[0])}
              />

              <button
                onClick={importKoordinator}
                className="w-full bg-blue-900 text-white py-3 rounded-lg hover:bg-blue-800"
              >
                Import Data
              </button>

              {importResult && importResult.failed_rows.length > 0 && (
                <div className="mt-6 max-h-64 overflow-y-auto border rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-red-700 mb-3">
                    Gagal Import ({importResult.failed_rows.length})
                  </h3>

                  <ul className="space-y-3 text-sm">
                    {importResult.failed_rows.map((row, i) => (
                      <li key={i} className="border-b pb-2">
                        <div className="font-medium text-red-800">
                          Baris {row.row} — {row.nama}
                        </div>
                        <ul className="list-disc ml-5 text-red-600">
                          {row.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>,
          document.getElementById("modal-root")
        )}

      {/* MODAL EXPORT PASSWORD */}
      {openExportModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* BACKDROP */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                setOpenExportModal(false);
                setExportPassword("");
              }}
            />

            {/* MODAL */}
            <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10">
              {/* HEADER */}
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-slate-800">
                  Konfirmasi Password
                </h2>
                <p className="text-sm text-slate-500">
                  Masukkan password akun untuk melanjutkan export data
                </p>
              </div>

              {/* ===== FAKE EMAIL (ANTI AUTOFILL) ===== */}
              <input
                type="email"
                name="email"
                autoComplete="email"
                tabIndex={-1}
                className="absolute -left-[9999px] opacity-0 pointer-events-none"
              />

              {/* ===== FAKE PASSWORD (PAIR EMAIL) ===== */}
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                tabIndex={-1}
                className="absolute -left-[9999px] opacity-0 pointer-events-none"
              />

              {/* ===== PASSWORD ASLI ===== */}
              <div className="relative mb-6">
                {/* ICON LOCK */}
                <Icon
                  icon="mdi:lock-outline"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  width={22}
                />

                <input
                  type={showPassword ? "text" : "password"}
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Password akun"
                  className="w-full border rounded-xl pl-12 pr-12 py-3
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* SHOW / HIDE */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  <Icon
                    icon={showPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"}
                    width="22"
                  />
                </button>
              </div>

              {/* ACTION */}
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => {
                    setOpenExportModal(false);
                    setExportPassword("");
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border
                       text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>

                <button
                  onClick={exportAllKoordinators}
                  disabled={exporting}
                  className={`w-full sm:w-auto px-5 py-2 rounded-lg
                    bg-blue-900 text-white hover:bg-blue-800 transition
                    ${exporting ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {exporting ? "Memproses..." : "Export"}
                </button>

              </div>
            </div>
          </div>,
          document.getElementById("modal-root")
        )}

    </div>
  );
}

