import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

/**
 * DUMMY DATA - Alat Peraga Kampanye (APK)
 */
const dummyItems = [
  {
    id: 1,
    nama: "Spanduk Paslon",
    kategori: "Banner",
    stok: 150,
    stokAwal: 200,
    satuan: "lembar",
    hargaSatuan: 75000,
    lokasi: "Gudang A - Rak 1",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/3b82f6/white?text=SPD",
  },
  {
    id: 2,
    nama: "Baliho 3x4m",
    kategori: "Billboard",
    stok: 25,
    stokAwal: 50,
    satuan: "unit",
    hargaSatuan: 500000,
    lokasi: "Gudang A - Rak 2",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/10b981/white?text=BLH",
  },
  {
    id: 3,
    nama: "Kaos Kampanye",
    kategori: "Merchandise",
    stok: 1200,
    stokAwal: 2000,
    satuan: "pcs",
    hargaSatuan: 45000,
    lokasi: "Gudang B - Rak 1",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/f59e0b/white?text=KAO",
  },
  {
    id: 4,
    nama: "Topi Kampanye",
    kategori: "Merchandise",
    stok: 800,
    stokAwal: 1000,
    satuan: "pcs",
    hargaSatuan: 25000,
    lokasi: "Gudang B - Rak 2",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/8b5cf6/white?text=TOP",
  },
  {
    id: 5,
    nama: "Stiker Paslon",
    kategori: "Sticker",
    stok: 5000,
    stokAwal: 10000,
    satuan: "lembar",
    hargaSatuan: 500,
    lokasi: "Gudang C - Rak 1",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/ec4899/white?text=STK",
  },
  {
    id: 6,
    nama: "Bendera Partai",
    kategori: "Flag",
    stok: 300,
    stokAwal: 500,
    satuan: "lembar",
    hargaSatuan: 35000,
    lokasi: "Gudang A - Rak 3",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/ef4444/white?text=BND",
  },
  {
    id: 7,
    nama: "Umbul-umbul",
    kategori: "Flag",
    stok: 180,
    stokAwal: 300,
    satuan: "lembar",
    hargaSatuan: 20000,
    lokasi: "Gudang A - Rak 4",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/06b6d4/white?text=UMB",
  },
  {
    id: 8,
    nama: "Poster A3",
    kategori: "Poster",
    stok: 2500,
    stokAwal: 5000,
    satuan: "lembar",
    hargaSatuan: 3000,
    lokasi: "Gudang C - Rak 2",
    kondisi: "baik",
    gambar: "https://placehold.co/100x100/84cc16/white?text=PST",
  },
];

/**
 * dummyTransactions:
 * tipe: "masuk" = penerimaan
 * tipe: "keluar" = pengambilan/distribusi
 */
const dummyTransactions = [
  {
    id: 1,
    tipe: "keluar",
    item: "Spanduk Paslon",
    jumlah: 20,
    tanggal: "2026-01-25",
    petugas: "Budi Santoso",
    tujuan: "Kec. Menteng",
  },
  {
    id: 2,
    tipe: "keluar",
    item: "Kaos Kampanye",
    jumlah: 100,
    tanggal: "2026-01-25",
    petugas: "Andi Wijaya",
    tujuan: "Kec. Kemang",
  },
  {
    id: 3,
    tipe: "masuk",
    item: "Topi Kampanye",
    jumlah: 200,
    tanggal: "2026-01-24",
    petugas: "Supplier A",
    tujuan: "Gudang B",
  },
  {
    id: 4,
    tipe: "keluar",
    item: "Stiker Paslon",
    jumlah: 500,
    tanggal: "2026-01-24",
    petugas: "Citra Dewi",
    tujuan: "Kec. Setiabudi",
  },
  {
    id: 5,
    tipe: "keluar",
    item: "Bendera Partai",
    jumlah: 50,
    tanggal: "2026-01-23",
    petugas: "Dedi Kurnia",
    tujuan: "Kec. Tebet",
  },
];

export default function APKIndex() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKategori, setSelectedKategori] = useState("Semua");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("masuk"); // masuk | keluar | stok | item

  // ===== KPI =====
  const totalItems = dummyItems.length;
  const totalStok = dummyItems.reduce((acc, item) => acc + item.stok, 0);
  const totalNilai = dummyItems.reduce((acc, item) => acc + item.stok * item.hargaSatuan, 0);
  const stokRendah = dummyItems.filter((item) => item.stok / item.stokAwal < 0.3).length;

  // ===== FILTER =====
  const kategoriList = useMemo(
    () => ["Semua", ...new Set(dummyItems.map((item) => item.kategori))],
    []
  );

  const filteredItems = useMemo(() => {
    return dummyItems.filter((item) => {
      const matchSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase());
      const matchKategori = selectedKategori === "Semua" || item.kategori === selectedKategori;
      return matchSearch && matchKategori;
    });
  }, [searchTerm, selectedKategori]);

  // ===== HELPERS =====
  const formatRupiah = (num) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Number(num || 0));

  const stokBadgeClass = (stok, stokAwal) => {
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
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        pill: "bg-blue-100 text-blue-700",
        sign: "+",
      };
    }
    return {
      label: "PENGAMBILAN",
      desc: "Pengambilan barang",
      icon: "mdi:arrow-up",
      badge: "bg-slate-50 text-slate-700 border-slate-200",
      pill: "bg-slate-100 text-slate-700",
      sign: "-",
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* HEADER */}
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Icon icon="mdi:warehouse" className="text-blue-700" width={36} />
          Gudang Alat Peraga Kampanye
        </h1>
        <p className="text-slate-500 mt-1">Kelola inventaris alat kampanye dengan mudah</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Jenis Item"
          value={totalItems}
          icon="mdi:package-variant-closed"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          title="Total Stok"
          value={totalStok.toLocaleString("id-ID")}
          icon="mdi:counter"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KpiCard
          title="Total Nilai Aset"
          value={formatRupiah(totalNilai)}
          icon="mdi:cash-multiple"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          valueClass="text-2xl"
        />
        <KpiCard
          title="Stok Rendah"
          value={stokRendah}
          icon="mdi:alert-circle"
          iconBg="bg-red-50"
          iconColor="text-red-500"
          valueClass="text-3xl text-red-600"
          footer="item perlu restock"
        />
      </div>

      {/* SEARCH + FILTER + ACTION */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Semantic Search (keyword search versi dummy) */}
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                width={20}
              />
              <input
                type="text"
                placeholder="Cari item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Filter kategori */}
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500
                         bg-white transition cursor-pointer hover:bg-slate-50"
            >
              {kategoriList.map((kat) => (
                <option key={kat} value={kat}>
                  {kat}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setModalType("masuk");
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Icon icon="mdi:arrow-down-bold-box" width={20} />
              Barang Masuk
            </button>

            <button
              onClick={() => {
                setModalType("keluar");
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              <Icon icon="mdi:arrow-up-bold-box" width={20} />
              Barang Keluar
            </button>

            <button
              onClick={() => {
                setModalType("stok");
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              <Icon icon="mdi:package-variant-plus" width={20} />
              Tambah Stok
            </button>

            <button
              onClick={() => {
                setModalType("item");
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors"
            >
              <Icon icon="mdi:plus" width={20} />
              Tambah Item
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* INVENTORY TABLE */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:view-list" className="text-blue-600" width={24} />
              Daftar Inventaris
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Harga Satuan
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Total Nilai
                  </th>
                  <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                          <img src={item.gambar} alt={item.nama} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{item.nama}</p>
                          <p className="text-xs text-slate-500">{item.lokasi}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border border-slate-200">
                        {item.kategori}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-bold border ${stokBadgeClass(
                          item.stok,
                          item.stokAwal
                        )}`}
                      >
                        {item.stok} {item.satuan}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right text-slate-600 font-medium text-sm">
                      {formatRupiah(item.hargaSatuan)}
                    </td>

                    <td className="px-5 py-4 text-right font-bold text-slate-800 text-sm">
                      {formatRupiah(item.stok * item.hargaSatuan)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Detail"
                        >
                          <Icon icon="mdi:eye" width={18} />
                        </button>
                        <button
                          className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition"
                          title="Edit"
                        >
                          <Icon icon="mdi:pencil" width={18} />
                        </button>
                        <button
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Hapus"
                        >
                          <Icon icon="mdi:delete" width={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      Tidak ada data inventaris yang cocok dengan pencarian/filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-fit">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:history" className="text-blue-600" width={24} />
              Histori Terakhir
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Menampilkan apakah transaksi adalah <b>penerimaan</b> atau <b>pengambilan</b> barang.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {dummyTransactions.map((tx) => {
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
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {meta.desc} • {tx.tanggal}
                        </p>
                      </div>
                    </div>

                    <span className="text-sm font-bold text-slate-700">
                      {meta.sign}
                      {tx.jumlah}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pl-11">
                    <span>{tx.petugas}</span>
                    <span>{tx.tujuan}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-200">
            <button className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition flex items-center justify-center gap-2 border border-transparent hover:border-blue-200">
              <Icon icon="mdi:arrow-right" width={18} />
              Lihat Semua Histori
            </button>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <Modal
          modalType={modalType}
          onClose={() => setShowModal(false)}
          items={dummyItems}
        />
      )}
    </div>
  );
}

/* =======================
   SMALL COMPONENTS
======================= */

function KpiCard({
  title,
  value,
  icon,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-600",
  valueClass = "text-3xl",
  footer,
}) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className={`font-bold text-slate-800 mt-1 ${valueClass}`}>{value}</p>
          {footer && <p className="text-xs text-slate-400">{footer}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon icon={icon} width={24} className={iconColor} />
        </div>
      </div>
    </div>
  );
}

function Modal({ modalType, onClose, items }) {
  const title =
    modalType === "stok"
      ? "Tambah Stok Item"
      : modalType === "masuk"
      ? "Barang Masuk (Penerimaan)"
      : modalType === "keluar"
      ? "Barang Keluar (Pengambilan)"
      : "Tambah Item";

  const icon =
    modalType === "masuk" || modalType === "stok"
      ? "mdi:arrow-down-bold-box"
      : modalType === "keluar"
      ? "mdi:arrow-up-bold-box"
      : "mdi:plus-box";

  const sourceLabel =
    modalType === "masuk" || modalType === "stok" ? "Sumber" : "Tujuan";

  const sourcePlaceholder =
    modalType === "masuk" || modalType === "stok"
      ? "Nama supplier / sumber"
      : "Tujuan distribusi";

  const showItemSelect = modalType !== "item";

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
          {showItemSelect && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Pilih Item
              </label>
              <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">-- Pilih Item --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nama} (Stok: {item.stok})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Jumlah
            </label>
            <input
              type="number"
              placeholder="Masukkan jumlah"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              {sourceLabel}
            </label>
            <input
              type="text"
              placeholder={sourcePlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Petugas
            </label>
            <input
              type="text"
              placeholder="Nama petugas"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Catatan (opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Tambahkan catatan..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
