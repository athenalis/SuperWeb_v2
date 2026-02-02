import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";

/** ===== DUMMY DATA (samain format sama index lo) ===== */
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
    gambar: "https://placehold.co/700x450/3b82f6/white?text=SPD",
    deskripsi: "Spanduk ukuran standar untuk pemasangan di area publik.",
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
    gambar: "https://placehold.co/700x450/10b981/white?text=BLH",
    deskripsi: "Baliho ukuran 3x4m untuk titik strategis.",
  },
];

const dummyTransactions = [
  {
    id: 1,
    itemId: 1,
    tipe: "keluar", // keluar = pengambilan
    jumlah: 20,
    tanggal: "2026-01-25",
    petugas: "Budi Santoso",
    tujuan: "Kec. Menteng",
    catatan: "Distribusi RW 03",
  },
  {
    id: 2,
    itemId: 1,
    tipe: "masuk", // masuk = penerimaan
    jumlah: 50,
    tanggal: "2026-01-22",
    petugas: "Supplier B",
    tujuan: "Gudang A",
    catatan: "Penerimaan batch awal",
  },
  {
    id: 3,
    itemId: 2,
    tipe: "masuk",
    jumlah: 10,
    tanggal: "2026-01-20",
    petugas: "Supplier A",
    tujuan: "Gudang A",
    catatan: "Tambahan stok",
  },
];

/** ===== HELPERS ===== */
const formatRupiah = (num) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(num || 0));

const stokBadgeClass = (stok, stokAwal) => {
  const ratio = stokAwal ? stok / stokAwal : 0;
  if (ratio > 0.5) return "bg-blue-50 text-blue-700 border-blue-200";
  if (ratio > 0.3) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
};

const kondisiBadgeClass = (kondisi = "") => {
  const k = String(kondisi).toLowerCase();
  if (k === "baik") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (k === "rusak") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

const txMeta = (tipe) => {
  if (tipe === "masuk") {
    return {
      label: "PENERIMAAN",
      icon: "mdi:arrow-down",
      pill: "bg-blue-100 text-blue-700",
      sign: "+",
      amount: "text-blue-700",
    };
  }
  return {
    label: "PENGAMBILAN",
    icon: "mdi:arrow-up",
    pill: "bg-slate-100 text-slate-700",
    sign: "-",
    amount: "text-slate-700",
  };
};

export default function ApkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const itemId = Number(id);

  const item = useMemo(() => dummyItems.find((x) => x.id === itemId), [itemId]);

  const itemTx = useMemo(() => {
    return dummyTransactions
      .filter((tx) => tx.itemId === itemId)
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  }, [itemId]);

  if (!item) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-800 font-semibold">Item tidak ditemukan.</p>
          <button
            onClick={() => navigate("/apk")}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Icon icon="mdi:arrow-left" width={18} />
            Kembali ke APK
          </button>
        </div>
      </div>
    );
  }

  const ratio = item.stokAwal ? item.stok / item.stokAwal : 0;
  const ratioPct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const nilaiAset = item.stok * item.hargaSatuan;

  const totalMasuk = itemTx.filter((t) => t.tipe === "masuk").reduce((a, t) => a + t.jumlah, 0);
  const totalKeluar = itemTx.filter((t) => t.tipe === "keluar").reduce((a, t) => a + t.jumlah, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/apk")}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Kembali"
          >
            <Icon icon="mdi:arrow-left" width={20} className="text-slate-700" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:package-variant" className="text-blue-700" width={26} />
              Detail Inventaris
            </h1>
            <p className="text-slate-500 text-sm">
              Informasi lengkap item + histori (penerimaan/pengambilan)
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
            <Icon icon="mdi:arrow-down-bold-box" width={18} />
            Barang Masuk
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition">
            <Icon icon="mdi:arrow-up-bold-box" width={18} />
            Barang Keluar
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition">
            <Icon icon="mdi:pencil" width={18} />
            Edit Item
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: ITEM CARD + HISTORI TABLE */}
        <div className="xl:col-span-2 space-y-6">
          {/* ITEM DETAIL CARD */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-5">
              {/* IMAGE */}
              <div className="lg:col-span-2 bg-slate-100">
                <img src={item.gambar} alt={item.nama} className="w-full h-64 lg:h-full object-cover" />
              </div>

              {/* INFO */}
              <div className="lg:col-span-3 p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{item.nama}</h2>
                    <p className="text-sm text-slate-500">{item.deskripsi || "—"}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full border text-xs font-extrabold ${kondisiBadgeClass(item.kondisi)}`}>
                    {String(item.kondisi || "unknown").toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                    {item.kategori}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                    Lokasi: {item.lokasi}
                  </span>
                </div>

                {/* STOCK + ASSET */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">STOK SAAT INI</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-md border text-xs font-extrabold ${stokBadgeClass(item.stok, item.stokAwal)}`}>
                          {item.stok} {item.satuan}
                        </span>
                        <span className="text-xs text-slate-500">
                          dari stok awal {item.stokAwal} {item.satuan}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-500">NILAI ASET</p>
                      <p className="text-lg font-bold text-slate-800">{formatRupiah(nilaiAset)}</p>
                    </div>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Progress stok</span>
                      <span>{ratioPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${ratioPct}%` }} />
                    </div>
                  </div>
                </div>

                {/* MINI STATS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MiniStat title="Harga Satuan" value={formatRupiah(item.hargaSatuan)} icon="mdi:cash" />
                  <MiniStat title="Total Penerimaan" value={`${totalMasuk} ${item.satuan}`} icon="mdi:arrow-down" />
                  <MiniStat title="Total Pengambilan" value={`${totalKeluar} ${item.satuan}`} icon="mdi:arrow-up" />
                </div>
              </div>
            </div>
          </div>

          {/* HISTORI TABLE */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Icon icon="mdi:history" className="text-blue-600" width={22} />
                Histori Transaksi Item
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Tipe transaksi ditandai sebagai <b>Penerimaan</b> (masuk) atau <b>Pengambilan</b> (keluar).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Tipe</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Tanggal</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Petugas</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Sumber/Tujuan</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Jumlah</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Catatan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {itemTx.map((tx) => {
                    const meta = txMeta(tx.tipe);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.pill}`}>
                              <Icon icon={meta.icon} width={18} />
                            </span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-700">
                              {meta.label}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">{tx.tanggal}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{tx.petugas}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{tx.tujuan}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-sm font-bold ${meta.amount}`}>
                            {meta.sign}
                            {tx.jumlah} {item.satuan}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{tx.catatan || "—"}</td>
                      </tr>
                    );
                  })}

                  {itemTx.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                        Belum ada histori transaksi untuk item ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: SUMMARY */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:information" className="text-blue-600" width={20} />
              Ringkasan
            </h3>

            <div className="mt-4 space-y-3 text-sm">
              <Row label="ID Item" value={`#${item.id}`} />
              <Row label="Kategori" value={item.kategori} />
              <Row label="Lokasi" value={item.lokasi} />
              <Row label="Stok" value={`${item.stok} ${item.satuan}`} />
              <Row label="Stok Awal" value={`${item.stokAwal} ${item.satuan}`} />
              <Row label="Harga Satuan" value={formatRupiah(item.hargaSatuan)} />
              <Row label="Nilai Aset" value={formatRupiah(nilaiAset)} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:alert-circle" className="text-blue-600" width={20} />
              Info
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              <b>Penerimaan</b> = barang masuk (supplier/transfer). <br />
              <b>Pengambilan</b> = barang keluar (distribusi ke lapangan).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ===== Components kecil ===== */
function MiniStat({ title, value, icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="text-base font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
          <Icon icon={icon} width={20} className="text-blue-600" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  );
}
