import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import PemasanganApk from "./pemasangan_apk";

/* =======================
   HELPERS
======================= */

const qtyToInt = (val) => {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  const first = s.split(".")[0];
  const n = Number(first.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const moneyToInt = (val) => {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  const first = s.split(".")[0];
  const n = Number(first.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const mapItemBEtoFE = (it) => {
  const stok = qtyToInt(it?.stock?.qty_current);
  const budgetTotal = moneyToInt(it?.budget_total ?? it?.stock?.budget_total);

  return {
    id: it.id,
    nama: it.name,
    kategori: it?.bentuk?.name || "-",
    stok,
    stokAwal: stok,
    satuan: it?.unit?.symbol || it?.unit?.name || "-",
    budgetTotal,
    lokasi: "-",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100?text=IMG",
  };
};

const mapHistoryBEtoFE = (h) => {
  const tipe = h.type === "IN" ? "masuk" : h.type === "OUT" ? "keluar" : "adjust";

  // ✅ OUT => koordinator, IN/ADJUST => admin_apk
  const petugas =
    h.type === "OUT"
      ? h?.coordinator?.nama || h?.actor_name || "-"
      : h?.creator?.name || h?.actor_name || "-";

  return {
    id: h.id,
    tipe,
    item: h?.item?.name || `Item #${h.item_id}`,
    jumlah: qtyToInt(h.qty),
    tanggal: (h.created_at || "").slice(0, 10),
    petugas,
    tujuan: h.note || "-",
  };
};

/* =======================
   PAGE
======================= */

export default function APKIndex() {
  const navigate = useNavigate();
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isApkKoordinator = role === "apk_koordinator";
  const isAdminApk = role === "admin_apk";
  const [pageView, setPageView] = useState("index");

  useEffect(() => {
    if (isApkKoordinator) setPageView("pemasangan");
  }, [isApkKoordinator]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKategori, setSelectedKategori] = useState("Semua");

  // ===== DATA FROM BE =====
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ✅ existing modal (tetep)
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("masuk"); // masuk | keluar | stok | item | admin_apk

  // ✅ NEW: modal detail item (SHOW)
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [itemDetail, setItemDetail] = useState(null);
  const [loadingItemDetail, setLoadingItemDetail] = useState(false);

  const openItemDetail = async (id) => {
    setSelectedItemId(id);
    setShowItemModal(true);
    setItemDetail(null);

    setLoadingItemDetail(true);
    try {
      const { data } = await api.get(`/apk/items/${id}`);
      if (!data?.status) {
        toast.error(data?.message || "Gagal ambil detail item");
        return;
      }
      setItemDetail(data?.data || null);
    } catch (e) {
      toast.error("Gagal ambil detail item (/apk/items/:id)");
    } finally {
      setLoadingItemDetail(false);
    }
  };

  const closeItemDetail = () => {
    setShowItemModal(false);
    setSelectedItemId(null);
    setItemDetail(null);
  };

  // ✅ budget KPI from /apk/budget
  const [budgetInfo, setBudgetInfo] = useState({
    totalBudget: 0,
    budgetTerpakai: 0,
    sisaBudget: 0,
  });
  const [loadingBudget, setLoadingBudget] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const { data } = await api.get("/apk/items");
        const rows = (data?.data || []).map(mapItemBEtoFE);
        setItems(rows);
      } catch (e) {
        toast.error("Gagal ambil data item gudang");
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    };

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data } = await api.get("/apk/stock/history");
        const rows = (data?.data?.data || []).map(mapHistoryBEtoFE);
        setTransactions(rows);
      } catch (e) {
        toast.error("Gagal ambil histori stok");
        setTransactions([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    const fetchBudget = async () => {
      setLoadingBudget(true);
      try {
        const { data } = await api.get("/apk/budget");
        if (!data?.status) {
          toast.error(data?.message || "Gagal ambil budget");
          setBudgetInfo({ totalBudget: 0, budgetTerpakai: 0, sisaBudget: 0 });
          return;
        }

        const total = moneyToInt(data?.data?.total_budget);
        const terpakai = moneyToInt(data?.data?.budget_terpakai);
        const sisa = moneyToInt(data?.data?.sisa_budget);

        setBudgetInfo({ totalBudget: total, budgetTerpakai: terpakai, sisaBudget: sisa });
      } catch (e) {
        toast.error("Gagal ambil budget (/apk/budget)");
        setBudgetInfo({ totalBudget: 0, budgetTerpakai: 0, sisaBudget: 0 });
      } finally {
        setLoadingBudget(false);
      }
    };

    fetchItems();
    fetchHistory();
    fetchBudget();
  }, []);

  // ===== KPI =====
  const totalStok = items.reduce((acc, item) => acc + (item.stok || 0), 0);
  const stokRendah = items.filter((item) => item.stokAwal > 0 && item.stok / item.stokAwal < 0.3).length;

  const totalBudget = budgetInfo.totalBudget;
  const totalBudgetTerpakai = budgetInfo.budgetTerpakai;

  // ===== FILTER =====
  const kategoriList = useMemo(() => ["Semua", ...new Set(items.map((item) => item.kategori))], [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase());
      const matchKategori = selectedKategori === "Semua" || item.kategori === selectedKategori;
      return matchSearch && matchKategori;
    });
  }, [items, searchTerm, selectedKategori]);

  // ===== HELPERS =====
  const formatRupiah = (num) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Number(num || 0));

  const stokBadgeClass = (stok, stokAwal) => {
    if (!stokAwal) return "bg-blue-50 text-blue-700 border-blue-200";
    const ratio = stok / stokAwal;
    if (ratio > 0.5) return "bg-blue-50 text-blue-700 border-blue-200";
    if (ratio > 0.3) return "bg-yellow-50 text-yellow-700 border-yellow-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  const txMeta = (tipe) => {
    if (tipe === "masuk") {
      return {
        label: "PENERIMAAN",
        desc: "Penerimaan barang",
        icon: "mdi:arrow-down",
        badge: "bg-blue-50 text-blue-700 border-blue-200 font-semibold",
        pill: "bg-blue-100 text-blue-700",
        sign: "+",
      };
    }

    if (tipe === "adjust") {
      return {
        label: "ADJUST",
        desc: "Penyesuaian stok",
        icon: "mdi:refresh",
        badge: "bg-amber-50 text-amber-800 border-amber-200 font-semibold",
        pill: "bg-amber-100 text-amber-800",
        sign: "",
      };
    }

    return {
      label: "PENGAMBILAN",
      desc: "Pengambilan barang",
      icon: "mdi:arrow-up",
      badge: "bg-slate-50 text-slate-700 border-slate-200 uppercase tracking-wide font-semibold",
      pill: "bg-slate-100 text-slate-700",
      sign: "-",
    };
  };

  const headerBtnClass =
    "flex items-center gap-2 px-4 py-2.5 bg-blue-600 border border-slate-200 rounded-lg " +
    "text-white hover:text-blue-800 hover:bg-white hover:border-blue-800 transition shadow-sm";

  if (pageView === "pemasangan") {
    return <PemasanganApk onBack={() => setPageView("index")} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl p-8 space-y-6">
      {/* HEADER */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-3">Gudang Alat Peraga Kampanye</h1>
          <p className="text-slate-500 mt-1">Kelola inventaris alat kampanye dengan mudah</p>
        </div>

        <div className="flex items-center gap-3">
          {!isApkKoordinator && (
            <button type="button" onClick={() => navigate("/kelolabarang")} className={headerBtnClass}>
              Kelola Barang
            </button>
          )}

          {!isAdminApk && (
            <button
              type="button"
              onClick={() => {
                if (isApkKoordinator) return setPageView("pemasangan");
                navigate("/adminapk");
              }}
              className={headerBtnClass}
            >
              {isApkKoordinator ? "Data Pemasangan APK" : "Data Admin"}
            </button>
          )}
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Stok"
          value={totalStok.toLocaleString("id-ID")}
          icon="material-symbols:home-storage-rounded"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          title="Stok Rendah"
          value={stokRendah}
          icon="mdi:alert-circle"
          iconBg="bg-red-50"
          iconColor="text-red-500"
          valueClass="text-3xl text-red-600"
        />
        <KpiCard
          title="Total Budget"
          value={loadingBudget ? "Loading..." : formatRupiah(totalBudget)}
          icon="solar:wallet-bold"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          valueClass="text-2xl"
        />
        <KpiCard
          title="Total Budget Terpakai"
          value={loadingBudget ? "Loading..." : formatRupiah(totalBudgetTerpakai)}
          icon="mdi:cash-multiple"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          valueClass="text-2xl"
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* INVENTORY TABLE */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Icon icon="material-symbols:inventory-rounded" className="text-blue-600" width={25} />
                  Daftar Inventaris
                </h2>
                <p className="text-xs text-slate-500 mt-1">Daftar barang yang ada di gudang</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:justify-end">
                <div className="relative w-full sm:w-64">
                  <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width={20} />
                  <input
                    type="text"
                    placeholder="Cari item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                  />
                </div>

                <div className="relative group">
                  <Icon
                    icon="mdi:chevron-down"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors"
                    width="22"
                  />
                  <select
                    value={selectedKategori}
                    onChange={(e) => setSelectedKategori(e.target.value)}
                    className="w-full appearance-none sm:w-44 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                              bg-white transition cursor-pointer hover:bg-slate-50 text-slate-800"
                  >
                    {kategoriList.map((kat) => (
                      <option key={kat} value={kat}>
                        {kat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Item</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Kategori</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Stok</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Total Budget</th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loadingItems ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      Loading inventaris...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      Tidak ada data inventaris yang cocok dengan pencarian/filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{item.nama}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border border-slate-200">
                          {item.kategori}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${stokBadgeClass(item.stok, item.stokAwal)}`}>
                          {item.stok.toLocaleString("id-ID")} {item.satuan}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right font-bold text-slate-800 text-sm">{formatRupiah(item.budgetTotal)}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Detail"
                            onClick={() => openItemDetail(item.id)}
                          >
                            <Icon icon="solar:eye-linear" width={18} />
                          </button>
                          <button
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Hapus"
                            onClick={() => toast.error("Belum diimplementasikan (hapus item)")}
                          >
                            <Icon icon="mynaui:trash" width={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-fit">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:history" className="text-blue-600" width={25} />
              Histori Terakhir
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Menampilkan apakah transaksi adalah <b>penerimaan</b> atau <b>pengambilan</b> barang.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {loadingHistory ? (
              <div className="p-4 text-slate-500 text-sm">Loading histori...</div>
            ) : transactions.length === 0 ? (
              <div className="p-4 text-slate-500 text-sm">Belum ada histori.</div>
            ) : (
              transactions.map((tx) => {
                const meta = txMeta(tx.tipe);
                return (
                  <div key={tx.id} className="p-4 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.pill}`}>
                          <Icon icon={meta.icon} width={18} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 text-sm">{tx.item}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.badge}`}>{meta.label}</span>
                          </div>

                          <p className="text-xs text-slate-500">
                            {meta.desc} • {tx.tanggal}
                          </p>
                        </div>
                      </div>

                      <span className="text-sm font-bold text-slate-700">
                        {meta.sign}
                        {tx.jumlah.toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pl-11">
                      <span>{tx.petugas}</span>
                      <span className="text-right">{tx.tujuan}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 border-t border-slate-200">
            <button
              className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition flex items-center justify-center gap-2 border border-transparent hover:border-blue-200"
              onClick={() => navigate("/history")}
            >
              <Icon icon="mdi:arrow-right" width={18} />
              Lihat Semua Histori
            </button>
          </div>
        </div>
      </div>

      {/* MODAL EXISTING (tetep) */}
      {showModal && (
        <Modal
          modalType={modalType}
          onClose={() => setShowModal(false)}
          items={items}
          adminApkForm={adminApkForm}
          setField={setField}
          adminApkErrors={adminApkErrors}
          adminApkLoading={adminApkLoading}
          adminApkResult={adminApkResult}
          onSubmitAdminApk={submitAdminApk}
          noHpHint={noHpHint}
          setNoHpHint={setNoHpHint}
          sanitizePhone={(v) => sanitizePhone(v)}
          isForbiddenLandline021={(v) => isForbiddenLandline021(v)}
        />
      )}

      {/* ✅ MODAL DETAIL ITEM (SHOW) */}
      <ItemDetailModal
        open={showItemModal}
        onClose={closeItemDetail}
        loading={loadingItemDetail}
        data={itemDetail}
        selectedItemId={selectedItemId}
      />
    </div>
  );
}

/* =======================
   SMALL COMPONENTS
======================= */

function KpiCard({ title, value, icon, iconBg = "bg-blue-50", iconColor = "text-blue-600", valueClass = "text-3xl", footer }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className={`font-bold text-slate-800 mt-1 ${valueClass}`}>{value}</p>
          {footer && <p className="text-xs text-slate-400">{footer}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon icon={icon} width={25} className={iconColor} />
        </div>
      </div>
    </div>
  );
}

function ItemDetailModal({ open, onClose, loading, data, selectedItemId }) {
  if (!open) return null;

  const stok = qtyToInt(data?.stock?.qty_current);
  const budget = moneyToInt(data?.budget_total ?? data?.stock?.budget_total);

  const formatRupiah = (num) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Number(num || 0));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Icon icon="solar:box-linear" className="text-blue-600" width={22} />
            Detail Item {selectedItemId ? `#${selectedItemId}` : ""}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
            aria-label="Close modal"
          >
            <Icon icon="mdi:close" width={20} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-10 text-center text-slate-500">
              <Icon icon="mdi:loading" width={36} className="mx-auto mb-2 animate-spin text-slate-300" />
              Loading detail...
            </div>
          ) : !data ? (
            <div className="py-10 text-center text-slate-500">Data tidak ditemukan</div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500">Nama</p>
                <p className="text-lg font-extrabold text-slate-900">{data?.name || "-"}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Bentuk</p>
                  <p className="font-bold text-slate-800">{data?.bentuk?.name || "-"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Kategori</p>
                  <p className="font-bold text-slate-800">{data?.bentuk?.category || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Stok</p>
                  <p className="font-extrabold text-slate-900">
                    {stok.toLocaleString("id-ID")} {data?.unit?.symbol || data?.unit?.name || ""}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Total Budget</p>
                  <p className="font-extrabold text-slate-900">{formatRupiah(budget)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Budget Note</p>
                <p className="font-semibold text-slate-800">{data?.budget_note || "-"}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Deskripsi</p>
                <p className="text-slate-700">{data?.description || "-"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* =======================
   MODAL EXISTING (punyamu)
   (aku keep sama persis)
======================= */

function Modal({
  modalType,
  onClose,
  items,
  adminApkForm,
  setField,
  adminApkErrors,
  adminApkLoading,
  adminApkResult,
  onSubmitAdminApk,
  noHpHint,
  setNoHpHint,
  sanitizePhone,
  isForbiddenLandline021,
}) {
  const title =
    modalType === "admin_apk"
      ? "Tambah Admin APK"
      : modalType === "stok"
      ? "Tambah Stok Item"
      : modalType === "masuk"
      ? "Data Barang Masuk"
      : "Tambah Item";

  const icon =
    modalType === "admin_apk"
      ? "mdi:account-plus"
      : modalType === "masuk" || modalType === "stok"
      ? "mdi:arrow-down-bold-box"
      : modalType === "keluar"
      ? "mdi:arrow-up-bold-box"
      : "mdi:plus-box";

  const sourceLabel = modalType === "masuk" || modalType === "stok" ? "Sumber" : "Tujuan";
  const sourcePlaceholder = modalType === "masuk" || modalType === "stok" ? "Nama supplier / sumber" : "Tujuan distribusi";
  const showItemSelect = modalType !== "item" && modalType !== "admin_apk";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Icon icon={icon} className="text-blue-600" width={24} />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
            aria-label="Close modal"
          >
            <Icon icon="mdi:close" width={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {modalType === "admin_apk" ? (
            <>
              {adminApkErrors?.general?.[0] && <p className="text-xs text-red-600">{adminApkErrors.general[0]}</p>}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama</label>
                <input
                  type="text"
                  placeholder="Nama admin"
                  value={adminApkForm?.nama ?? ""}
                  onChange={(e) => setField("nama", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {adminApkErrors?.nama?.[0] && <p className="text-xs text-red-600">{adminApkErrors.nama[0]}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">NIK</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Masukkan NIK (16 digit)"
                  value={adminApkForm?.nik ?? ""}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 16);
                    setField("nik", onlyDigits);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-500">Wajib 16 digit angka</span>
                  <span className={adminApkForm?.nik?.length === 16 ? "text-green-600" : "text-slate-400"}>
                    {adminApkForm?.nik?.length || 0}/16
                  </span>
                </div>

                {adminApkErrors?.nik?.[0] && <p className="text-xs text-red-600">{adminApkErrors.nik[0]}</p>}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1">
                  No. HP
                  {noHpHint && <span className="text-xs font-medium text-red-600">{noHpHint}</span>}
                </label>

                <input
                  type="text"
                  inputMode="tel"
                  placeholder="Masukkan nomor HP"
                  value={adminApkForm?.no_hp ?? ""}
                  onChange={(e) => {
                    const cleaned = sanitizePhone(e.target.value);
                    setField("no_hp", cleaned);

                    if (isForbiddenLandline021(cleaned)) setNoHpHint("Nomor tidak boleh diawali 021 (telepon rumah).");
                    else setNoHpHint("");
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {adminApkErrors?.no_hp?.[0] && <p className="text-xs text-red-600">{adminApkErrors.no_hp[0]}</p>}
              </div>
            </>
          ) : (
            <>
              {showItemSelect && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Item</label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Pilih Item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nama} (Stok: {item.stok})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Jumlah</label>
                <input type="number" placeholder="Masukkan jumlah" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{sourceLabel}</label>
                <input type="text" placeholder={sourcePlaceholder} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Petugas</label>
                <input type="text" placeholder="Nama petugas" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan (opsional)</label>
                <textarea rows={2} placeholder="Tambahkan catatan..." className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition">
            Batal
          </button>
          <button
            onClick={() => {
              if (modalType === "admin_apk") onSubmitAdminApk?.();
            }}
            disabled={modalType === "admin_apk" && adminApkLoading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-60"
          >
            {modalType === "admin_apk" && adminApkLoading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
