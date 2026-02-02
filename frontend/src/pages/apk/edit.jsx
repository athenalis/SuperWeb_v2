import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate, useParams } from "react-router-dom";

/** ===== DUMMY DATA (samain sama index/detail) ===== */
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

/** ===== HELPERS ===== */
const formatRupiah = (num) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(num || 0));

const kondisiBadgeClass = (kondisi = "") => {
  const k = String(kondisi).toLowerCase();
  if (k === "baik") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (k === "rusak") return "bg-red-50 text-red-700 border-red-200";
  if (k === "perbaikan") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export default function ApkEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const itemId = Number(id);

  const item = useMemo(() => dummyItems.find((x) => x.id === itemId), [itemId]);

  const [loading, setLoading] = useState(false);

  // form state
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [satuan, setSatuan] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [kondisi, setKondisi] = useState("baik");
  const [hargaSatuan, setHargaSatuan] = useState(0);
  const [stokAwal, setStokAwal] = useState(0);
  const [stok, setStok] = useState(0);
  const [gambar, setGambar] = useState("");
  const [deskripsi, setDeskripsi] = useState("");

  // init form
  useEffect(() => {
    if (!item) return;
    setNama(item.nama || "");
    setKategori(item.kategori || "");
    setSatuan(item.satuan || "");
    setLokasi(item.lokasi || "");
    setKondisi(item.kondisi || "baik");
    setHargaSatuan(Number(item.hargaSatuan || 0));
    setStokAwal(Number(item.stokAwal || 0));
    setStok(Number(item.stok || 0));
    setGambar(item.gambar || "");
    setDeskripsi(item.deskripsi || "");
  }, [item]);

  const nilaiAset = useMemo(() => {
    return Number(stok || 0) * Number(hargaSatuan || 0);
  }, [stok, hargaSatuan]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // validasi ringan
    if (!nama.trim()) return alert("Nama item wajib diisi");
    if (!kategori.trim()) return alert("Kategori wajib diisi");
    if (!satuan.trim()) return alert("Satuan wajib diisi");
    if (Number(stok) < 0 || Number(stokAwal) < 0) return alert("Stok tidak boleh negatif");
    if (Number(stok) > Number(stokAwal)) {
      return alert("Stok sekarang tidak boleh lebih besar dari stok awal");
    }

    setLoading(true);
    try {
      // TODO: ganti ke API update beneran
      // await api.put(`/apk/${itemId}`, payload)
      const payload = {
        nama,
        kategori,
        satuan,
        lokasi,
        kondisi,
        hargaSatuan: Number(hargaSatuan),
        stokAwal: Number(stokAwal),
        stok: Number(stok),
        gambar,
        deskripsi,
      };

      console.log("SUBMIT APK EDIT:", payload);

      // simulasi sukses
      alert("Berhasil simpan (dummy).");
      navigate(`/apk/${itemId}`);
    } catch (err) {
      console.error(err);
      alert("Gagal simpan.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Kembali"
          >
            <Icon icon="mdi:arrow-left" width={20} className="text-slate-700" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:pencil" className="text-blue-700" width={24} />
              Edit Item APK
            </h1>
            <p className="text-slate-500 text-sm">
              Ubah data inventaris alat peraga kampanye
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full border text-xs font-extrabold ${kondisiBadgeClass(
              kondisi
            )}`}
          >
            {String(kondisi || "unknown").toUpperCase()}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT: FORM */}
        <div className="xl:col-span-2 space-y-6">
          {/* FORM CARD */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Icon icon="mdi:clipboard-text" className="text-blue-600" width={22} />
                Data Item
              </h2>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama */}
              <Field label="Nama Item" required>
                <input
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: Spanduk Paslon"
                />
              </Field>

              {/* Kategori */}
              <Field label="Kategori" required>
                <input
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: Banner / Merchandise"
                />
              </Field>

              {/* Satuan */}
              <Field label="Satuan" required>
                <input
                  value={satuan}
                  onChange={(e) => setSatuan(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="lembar / pcs / unit"
                />
              </Field>

              {/* Lokasi */}
              <Field label="Lokasi Penyimpanan">
                <input
                  value={lokasi}
                  onChange={(e) => setLokasi(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Gudang A - Rak 1"
                />
              </Field>

              {/* Kondisi */}
              <Field label="Kondisi">
                <select
                  value={kondisi}
                  onChange={(e) => setKondisi(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                >
                  <option value="baik">Baik</option>
                  <option value="perbaikan">Perbaikan</option>
                  <option value="rusak">Rusak</option>
                </select>
              </Field>

              {/* Harga */}
              <Field label="Harga Satuan (IDR)">
                <input
                  type="number"
                  value={hargaSatuan}
                  onChange={(e) => setHargaSatuan(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="75000"
                  min={0}
                />
                <p className="text-xs text-slate-500 mt-1">{formatRupiah(hargaSatuan)}</p>
              </Field>

              {/* Stok Awal */}
              <Field label="Stok Awal">
                <input
                  type="number"
                  value={stokAwal}
                  onChange={(e) => setStokAwal(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
              </Field>

              {/* Stok Sekarang */}
              <Field label="Stok Sekarang">
                <input
                  type="number"
                  value={stok}
                  onChange={(e) => setStok(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Nilai Aset: <b className="text-slate-800">{formatRupiah(nilaiAset)}</b>
                </p>
              </Field>

              {/* Gambar */}
              <div className="md:col-span-2">
                <Field label="URL Gambar">
                  <input
                    value={gambar}
                    onChange={(e) => setGambar(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    (sementara pakai URL dulu, nanti bisa diganti upload)
                  </p>
                </Field>
              </div>

              {/* Deskripsi */}
              <div className="md:col-span-2">
                <Field label="Deskripsi">
                  <textarea
                    rows={4}
                    value={deskripsi}
                    onChange={(e) => setDeskripsi(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Deskripsi singkat item..."
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/apk/${itemId}`)}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm inline-flex items-center gap-2 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icon icon="mdi:loading" width={18} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Icon icon="mdi:content-save" width={18} />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div className="space-y-6">
          {/* PREVIEW CARD */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Icon icon="mdi:image" className="text-blue-600" width={20} />
                Preview
              </h3>
            </div>

            <div className="p-5 space-y-4">
              <div className="w-full aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                {gambar ? (
                  <img src={gambar} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                    Belum ada gambar
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-800">{nama || "—"}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                    {kategori || "Kategori"}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold border border-slate-200">
                    {stok || 0} {satuan || "satuan"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{lokasi || "Lokasi belum diisi"}</p>
              </div>
            </div>
          </div>

          {/* QUICK INFO */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Icon icon="mdi:information" className="text-blue-600" width={20} />
              Catatan
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              Stok sekarang sebaiknya berubah lewat transaksi (Masuk/Keluar). Field stok di edit ini
              buat koreksi admin (misal audit).
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {required && <span className="text-xs font-bold text-red-500">*</span>}
      </div>
      {children}
    </label>
  );
}
