import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import api from "../../../lib/axios";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";

export default function RelawanApk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = localStorage.getItem("role");

  // ================= STATE MODALS & UTILS =================
  const [openImport, setOpenImport] = useState(false);
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [showExportPassword, setShowExportPassword] = useState(false);

  // ================= DATATABLE & PAGINATION =================
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  // ================= WILAYAH =================
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  // ================= FILTER STATE =================
  // APK: keyword dipakai untuk Nama/NIK/No HP (TPS dihapus)
  const [filters, setFilters] = useState({
    keyword: "",
    city_code: "",
    district_code: "",
    village_code: "",
  });

  const [activeFilters, setActiveFilters] = useState({});

  // ================= LOAD WILAYAH =================
  useEffect(() => {
    api.get("/wilayah/cities/31").then((res) => setCities(res.data));
  }, []);

  const loadDistricts = async (cityCode) => {
    if (!cityCode) return setDistricts([]);
    const res = await api.get(`/wilayah/districts/${cityCode}`);
    setDistricts(res.data);
  };

  const loadVillages = async (districtCode) => {
    if (!districtCode) return setVillages([]);
    const res = await api.get(`/wilayah/villages/${districtCode}`);
    setVillages(res.data);
  };

  // ================= FETCH DATA =================
  const fetchRelawanApk = async () => {
    const res = await api.get("/relawan-apk", {
      params: activeFilters,
    });
    const result = res.data.data;
    if (Array.isArray(result)) return result;
    return result?.data || [];
  };

  const {
    data: relawan = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["relawan-apk", activeFilters],
    queryFn: fetchRelawanApk,
  });

  // Reset page saat filter atau perPage berubah
  useEffect(() => {
    setPage(1);
  }, [perPage, activeFilters]);

  // ================= LOGIC FILTER CLIENT-SIDE =================
  // APK: cek Nama ATAU NIK ATAU No HP
  const semanticFiltered = relawan.filter((item) => {
    const searchKeyword = (filters.keyword || "").toLowerCase().trim();
    if (!searchKeyword) return true;

    const matchNama = (item.nama || "").toLowerCase().includes(searchKeyword);
    const matchNik = String(item.nik || "").includes(searchKeyword);
    const matchHp = String(item.no_hp || "").includes(searchKeyword);

    return matchNama || matchNik || matchHp;
  });

  const totalPage = Math.ceil(semanticFiltered.length / perPage) || 1;
  const paginatedData = semanticFiltered.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const pages = Array.from({ length: totalPage }, (_, i) => i + 1);

  // ================= FILTER ACTIONS =================
  const applyFilter = () => {
    setActiveFilters(filters);
  };

  const resetFilter = () => {
    const initial = {
      keyword: "",
      city_code: "",
      district_code: "",
      village_code: "",
    };
    setFilters(initial);
    setActiveFilters({});
    setDistricts([]);
    setVillages([]);
  };

  // ================= ACTIONS (EXPORT/IMPORT/DELETE) =================
  const handleConfirmExport = async () => {
    if (!exportPassword) return toast.error("Masukkan password terlebih dahulu");

    const toastId = "export-relawan-apk";
    try {
      setExporting(true);
      toast.loading("Menyiapkan file Excel...", { id: toastId });

      const res = await api.post(
        "/relawan-apk/export-all",
        { password: exportPassword },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;

      const filename =
        res.headers["content-disposition"]
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "relawan_apk.xlsx";

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Export berhasil", { id: toastId });
      closeExportModal();
    } catch (err) {
      toast.error(
        err.response?.status === 422
          ? err.response?.data?.message
          : "Gagal export",
        { id: toastId }
      );
    } finally {
      setExporting(false);
    }
  };

  const closeExportModal = () => {
    setShowPasswordModal(false);
    setExportPassword("");
    setShowExportPassword(false);
    setExporting(false);
  };

  const importRelawan = async () => {
    if (!file) return alert("Pilih file terlebih dahulu");
    setImporting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/relawan-apk/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setImportResult(res.data.data);

      const successCount =
        res.data.data?.success_count ??
        res.data.data?.successCount ??
        0;

      if (successCount > 0) {
        setSuccessMessage(`${successCount} relawan berhasil ditambahkan!`);
        queryClient.invalidateQueries(["relawan-apk"]);
        setTimeout(() => {
          setSuccessMessage("");
          closeImportModal();
        }, 2000);
      }
    } catch (error) {
      console.error(error);
      alert("Gagal import data");
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setOpenImport(false);
    setFile(null);
    setImportResult(null);
    setImporting(false);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/relawan-apk/${id}`),
    onMutate: () =>
      toast.loading("Menghapus relawan...", { id: "delete-relawan-apk" }),
    onSuccess: () => {
      queryClient.invalidateQueries(["relawan-apk"]);
      toast.success("Relawan berhasil dihapus", { id: "delete-relawan-apk" });
    },
    onError: () =>
      toast.error("Gagal menghapus relawan", { id: "delete-relawan-apk" }),
  });

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/relawan-apk/template", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "template_relawan_apk.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Gagal mengunduh template");
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="bg-white rounded-lg p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 ">
        <h1 className="text-3xl font-bold text-blue-900 ">
          Data Relawan APK
        </h1>

        {role !== "admin" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setOpenImport(true)}
              className="bg-blue-500/15 text-blue-800 border border-blue-200/40 px-4 py-2 rounded-lg hover:bg-blue-500/25"
            >
              Import Data Relawan
            </button>

            <button
              onClick={() => navigate("/relawan/apk/create")}
              className="bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-blue-800"
            >
              Tambah Relawan +
            </button>
          </div>
        )}
      </div>

      {/* ================= FILTER SECTION ================= */}
      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Icon
            icon="mdi:filter-variant"
            className="text-blue-700"
            width="28"
          />
          <div>
            <div className="text-lg font-semibold">Filter Data</div>
            <div className="text-sm text-slate-400">
              Cari data berdasarkan Nama, NIK, No HP, atau Wilayah
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* SEARCH BOX */}
          <div className="md:col-span-4 relative group">
            <Icon
              icon="mdi:magnify"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors"
              width="24"
            />
            <input
              className="w-full border border-gray-400 pl-12 pr-5 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-gray-400"
              placeholder="Cari Nama / NIK / No HP"
              value={filters.keyword}
              onChange={(e) =>
                setFilters({ ...filters, keyword: e.target.value })
              }
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            />
          </div>

          {/* REGION FILTERS */}
          <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* KOTA */}
            <div className="relative group">
              <Icon
                icon="mdi:chevron-down"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors"
                width="22"
              />
              <select
                className={`w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 ${
                  filters.city_code ? "text-slate-800" : "text-slate-400"
                }`}
                value={filters.city_code}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters({
                    ...filters,
                    city_code: val,
                    district_code: "",
                    village_code: "",
                  });
                  loadDistricts(val);
                }}
              >
                <option value="">Pilih Kota/Kabupaten</option>
                {cities.map((c) => (
                  <option key={c.city_code} value={c.city_code}>
                    {c.city}
                  </option>
                ))}
              </select>
            </div>

            {/* KECAMATAN */}
            <div className="relative group">
              <Icon
                icon="mdi:chevron-down"
                className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  !filters.city_code
                    ? "text-gray-200"
                    : "text-slate-400 group-focus-within:text-blue-600"
                }`}
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
                {districts.map((d) => (
                  <option key={d.district_code} value={d.district_code}>
                    {d.district}
                  </option>
                ))}
              </select>
            </div>

            {/* KELURAHAN */}
            <div className="relative group">
              <Icon
                icon="mdi:chevron-down"
                className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  !filters.district_code
                    ? "text-gray-200"
                    : "text-slate-400 group-focus-within:text-blue-600"
                }`}
                width="22"
              />
              <select
                className="w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 disabled:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200"
                value={filters.village_code}
                disabled={!filters.district_code}
                onChange={(e) =>
                  setFilters({ ...filters, village_code: e.target.value })
                }
              >
                <option value="">Pilih Kelurahan</option>
                {villages.map((v) => (
                  <option key={v.village_code} value={v.village_code}>
                    {v.village}
                  </option>
                ))}
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

          <div className="flex-1 md:flex-none" />

          <button
            onClick={() => setShowPasswordModal(true)}
            className="bg-blue-100 text-blue-800 px-6 py-2 rounded-lg hover:bg-blue-200 transition border border-green-200 flex items-center gap-4 font-bold"
          >
            Export Akun
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span>Tampilkan</span>
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          className="border rounded-lg px-3 py-1"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <span>data</span>
      </div>

      {/* ================= TABLE ================= */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {/* ================= MOBILE CARD VIEW (< md) ================= */}
        <div className="md:hidden space-y-4 px-4 pb-4">
          {isLoading && <div className="text-center py-6">Loading...</div>}
          {isError && (
            <div className="text-center py-6 text-red-600">
              Gagal memuat data
            </div>
          )}

          {!isLoading && !isError && paginatedData.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              <Icon icon="mdi:database-off-outline" width={36} className="mx-auto mb-2" />
              <p className="font-medium">Data belum tersedia</p>
              <p className="text-sm opacity-70">
                Belum ada data relawan yang bisa ditampilkan
              </p>
            </div>
          )}

          {!isLoading &&
            !isError &&
            paginatedData.map((item) => (
              <div
                key={item.id}
                className="bg-white border rounded-xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{item.nama}</h3>
                    <p className="text-sm text-gray-500">{item.nik}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold shrink-0 ml-2 ${
                      item.status === "active"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold"
                        : "bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                    }`}
                  >
                    {item.status === "active" ? "Aktif" : "Tidak Aktif"}
                  </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="mdi:map-marker-outline"
                      width={16}
                      className="text-gray-400 shrink-0"
                    />
                    <span>{item.village?.village || "-"}</span>
                  </div>

                  {item.no_hp && (
                    <div className="flex items-center gap-2">
                      <Icon
                        icon="mdi:phone-outline"
                        width={16}
                        className="text-gray-400 shrink-0"
                      />
                      <span>{item.no_hp}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t flex items-center gap-2">
                  {role !== "admin" && (
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 shrink-0"
                    >
                      <Icon icon="solar:trash-bin-trash-outline" width={20} />
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/relawan/apk/${item.id}`)}
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
        <table className="w-full text-base hidden md:table border-separate border-spacing-0">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-5 py-4 text-left font-bold text-slate-700">
                Nama
              </th>
              <th className="px-5 py-4 text-left hidden md:table-cell font-bold text-slate-700">
                NIK
              </th>
              <th className="px-5 py-4 text-left hidden md:table-cell font-bold text-slate-700">
                Wilayah
              </th>
              <th className="px-5 py-4 text-left hidden md:table-cell font-bold text-slate-700">
                No. HP
              </th>
              <th className="px-5 py-4 text-center hidden md:table-cell font-bold text-slate-700">
                Status
              </th>
              <th className="px-5 py-4 text-center font-bold text-slate-700">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan="6" className="py-10 text-center text-slate-500">
                  Loading data...
                </td>
              </tr>
            )}

            {isError && (
              <tr>
                <td colSpan="6" className="py-10 text-center text-red-600">
                  Gagal memuat data
                </td>
              </tr>
            )}

            {!isLoading && !isError && paginatedData.length === 0 && (
              <tr>
                <td colSpan="6" className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2 opacity-60">
                    <Icon icon="mdi:database-off-outline" width={48} />
                    <p className="font-semibold text-lg">Data belum tersedia</p>
                    <p className="text-sm">
                      Belum ada data relawan yang dapat ditampilkan.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className="group border-t hover:bg-blue-50/50 transition-all duration-200"
                >
                  <td className="px-5 py-4 font-medium text-slate-800">
                    {item.nama}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-slate-600">
                    {item.nik}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-slate-600">
                    {item.village?.village || "-"}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-slate-600">
                    {item.no_hp}
                  </td>

                  <td className="px-5 py-4 hidden md:table-cell text-center">
                    <span
                      className={`inline-flex justify-center items-center min-w-[100px] px-4 py-1.5 rounded-full text-xs font-bold transition-all
                      ${
                        item.status === "active"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold"
                          : "bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                      }`}
                    >
                      {item.status === "active" ? "Aktif" : "Tidak Aktif"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {role !== "admin" && (
                        <button
                          onClick={() => setDeleteTarget(item)}
                          title="Hapus"
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-red-600 border border-red-400 bg-white hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm hover:shadow-red-500/30"
                        >
                          <Icon icon="solar:trash-bin-trash-outline" width={18} />
                        </button>
                      )}

                      <button
                        onClick={() => navigate(`/relawan/apk/${item.id}`)}
                        title="Lihat Detail"
                        className="w-9 h-9 flex items-center justify-center text-blue-600 border border-blue-400 bg-white rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm hover:shadow-blue-500/30"
                      >
                        <Icon icon="si:eye-line" width={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!isLoading && !isError && paginatedData.length > 0 && (
          <div className="flex justify-between items-center px-6 py-4">
            <div className="text-sm text-slate-500">
              Halaman {page} dari {totalPage}
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
                  className={`px-3 py-1 rounded-lg border ${
                    p === page
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

      {/* ================= MODALS ================= */}
      {/* Modal Delete */}
      {deleteTarget &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />

            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Hapus Relawan
              </h2>

              {/* NOTE: di APK mungkin count nya beda. Kalau ga ada, aman (undefined > 0 => false) */}
              {deleteTarget.apk_forms_count > 0 ? (
                <div className="text-slate-700">
                  <p className="mb-4">
                    Relawan{" "}
                    <span className="font-semibold">“{deleteTarget.nama}”</span>{" "}
                    masih mempunyai{" "}
                    <span className="font-semibold text-red-600">
                      {deleteTarget.apk_forms_count}
                    </span>{" "}
                    data.
                  </p>

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-slate-600 mb-6">
                    Yakin ingin menghapus relawan{" "}
                    <span className="font-semibold text-slate-800">
                      “{deleteTarget.nama}”
                    </span>
                    ?
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>

                    <button
                      onClick={() => {
                        deleteMutation.mutate(deleteTarget.id);
                        setDeleteTarget(null);
                      }}
                      className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                    >
                      Hapus
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.getElementById("modal-root")
        )}

      {/* Modal Import */}
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
                Import Data Relawan
              </h2>

              <ol className="list-decimal list-inside text-md text-slate-600 space-y-1 mb-5">
                <li>Download template Excel</li>
                <li>Isi data sesuai format</li>
                <li>Upload file lalu klik Import</li>
              </ol>

              <button
                className="w-full border border-blue-600 text-blue-600 py-2.5 rounded-lg mb-7 hover:bg-blue-50"
                onClick={downloadTemplate}
              >
                Download Template Excel
              </button>

              <div className="mb-1">
                <label className="text-md font-medium mb-2 block">
                  Upload File Excel
                </label>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  className="w-full border rounded-lg px-4 py-2 text-sm mb-4"
                  onChange={(e) => setFile(e.target.files[0])}
                />
              </div>

              <button
                onClick={importRelawan}
                disabled={importing}
                className={`w-full py-3 rounded-lg text-white ${
                  importing
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-900 hover:bg-blue-800"
                }`}
              >
                {importing ? "Mengimpor..." : "Import Data"}
              </button>

              {importResult && importResult.failed_rows?.length > 0 && (
                <div className="mt-6 max-h-64 overflow-y-auto border rounded-lg p-4 bg-red-50">
                  <h3 className="font-semibold text-red-700 mb-3">
                    Gagal Import ({importResult.failed_rows.length})
                  </h3>

                  <ul className="space-y-3 text-sm">
                    {importResult.failed_rows.map((row, i) => (
                      <li key={i} className="border-b pb-2">
                        <div className="font-medium text-red-800">
                          Baris {row.row} — {row.nama || "-"}
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

            {successMessage && (
              <div
                className="fixed bottom-5 right-5 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg"
                onClick={() => setSuccessMessage("")}
              >
                {successMessage}
              </div>
            )}
          </div>,
          document.getElementById("modal-root")
        )}

      {/* Modal Password */}
      {showPasswordModal &&
        createPortal(
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
                    icon={
                      showExportPassword
                        ? "mdi:eye-off-outline"
                        : "mdi:eye-outline"
                    }
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
                  className={`w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition 
                  ${
                    exporting || !exportPassword
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {exporting ? "Memproses..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>,
          document.getElementById("modal-root")
        )}
    </div>
  );
}
