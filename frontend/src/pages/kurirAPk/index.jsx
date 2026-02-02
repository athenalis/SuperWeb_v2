import { useState } from "react";
import { Icon } from "@iconify/react";
import Navbar from "../../components/Navbar";

/**
 * DUMMY DATA - Kurir APK (Alat Peraga Kampanye)
 * Halaman untuk mengelola pengiriman dan distribusi APK
 */
const dummyKurir = [
    {
        id: 1,
        nama: "Ahmad Fadli",
        telepon: "081234567890",
        area: "Jakarta Pusat",
        status: "aktif",
        totalPengiriman: 156,
        rating: 4.8,
        foto: "https://placehold.co/100x100/3b82f6/white?text=AF",
    },
    {
        id: 2,
        nama: "Budi Santoso",
        telepon: "081234567891",
        area: "Jakarta Selatan",
        status: "aktif",
        totalPengiriman: 203,
        rating: 4.9,
        foto: "https://placehold.co/100x100/10b981/white?text=BS",
    },
    {
        id: 3,
        nama: "Citra Dewi",
        telepon: "081234567892",
        area: "Jakarta Timur",
        status: "aktif",
        totalPengiriman: 178,
        rating: 4.7,
        foto: "https://placehold.co/100x100/f59e0b/white?text=CD",
    },
    {
        id: 4,
        nama: "Dedi Kurnia",
        telepon: "081234567893",
        area: "Jakarta Barat",
        status: "nonaktif",
        totalPengiriman: 89,
        rating: 4.5,
        foto: "https://placehold.co/100x100/8b5cf6/white?text=DK",
    },
    {
        id: 5,
        nama: "Eka Putri",
        telepon: "081234567894",
        area: "Jakarta Utara",
        status: "aktif",
        totalPengiriman: 134,
        rating: 4.6,
        foto: "https://placehold.co/100x100/ec4899/white?text=EP",
    },
];

const dummyPengiriman = [
    {
        id: 1,
        kurir: "Ahmad Fadli",
        item: "Spanduk Paslon",
        jumlah: 20,
        tujuan: "Kec. Menteng",
        alamat: "Jl. Menteng Raya No. 45",
        tanggal: "2026-02-02",
        status: "dikirim",
    },
    {
        id: 2,
        kurir: "Budi Santoso",
        item: "Kaos Kampanye",
        jumlah: 100,
        tujuan: "Kec. Kemang",
        alamat: "Jl. Kemang Raya No. 12",
        tanggal: "2026-02-02",
        status: "selesai",
    },
    {
        id: 3,
        kurir: "Citra Dewi",
        item: "Baliho 3x4m",
        jumlah: 5,
        tujuan: "Kec. Cakung",
        alamat: "Jl. Raya Cakung No. 88",
        tanggal: "2026-02-01",
        status: "pending",
    },
    {
        id: 4,
        kurir: "Ahmad Fadli",
        item: "Stiker Paslon",
        jumlah: 500,
        tujuan: "Kec. Senen",
        alamat: "Jl. Senen Raya No. 33",
        tanggal: "2026-02-01",
        status: "selesai",
    },
    {
        id: 5,
        kurir: "Eka Putri",
        item: "Bendera Partai",
        jumlah: 50,
        tujuan: "Kec. Kelapa Gading",
        alamat: "Jl. Boulevard Kelapa Gading",
        tanggal: "2026-02-01",
        status: "dikirim",
    },
];

export default function KurirApkIndex() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedArea, setSelectedArea] = useState("Semua");
    const [activeTab, setActiveTab] = useState("kurir"); // kurir atau pengiriman
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState("tambah-kurir");

    // Statistik
    const totalKurir = dummyKurir.length;
    const kurirAktif = dummyKurir.filter((k) => k.status === "aktif").length;
    const totalPengiriman = dummyPengiriman.length;
    const pengirimanSelesai = dummyPengiriman.filter((p) => p.status === "selesai").length;

    // Filter
    const areaList = ["Semua", ...new Set(dummyKurir.map((k) => k.area))];

    const filteredKurir = dummyKurir.filter((k) => {
        const matchSearch = k.nama.toLowerCase().includes(searchTerm.toLowerCase());
        const matchArea = selectedArea === "Semua" || k.area === selectedArea;
        return matchSearch && matchArea;
    });

    const filteredPengiriman = dummyPengiriman.filter((p) => {
        const matchSearch =
            p.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.kurir.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.tujuan.toLowerCase().includes(searchTerm.toLowerCase());
        return matchSearch;
    });

    const getStatusBadge = (status) => {
        const styles = {
            aktif: "bg-emerald-100 text-emerald-700 border-emerald-200",
            nonaktif: "bg-slate-100 text-slate-600 border-slate-200",
            pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
            dikirim: "bg-blue-100 text-blue-700 border-blue-200",
            selesai: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
        return styles[status] || "bg-slate-100 text-slate-600 border-slate-200";
    };

    const getStatusLabel = (status) => {
        const labels = {
            aktif: "Aktif",
            nonaktif: "Nonaktif",
            pending: "Pending",
            dikirim: "Dikirim",
            selesai: "Selesai",
        };
        return labels[status] || status;
    };

    return (
        <>
            {/* <Navbar /> */}
            <div className="min-h-screen bg-slate-50 p-6">
                {/* HEADER */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Icon icon="mdi:truck-delivery" className="text-blue-700" width={36} />
                        Manajemen Kurir APK
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Kelola kurir dan pengiriman alat peraga kampanye
                    </p>
                </div>

                {/* STATS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Total Kurir */}
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

                    {/* Kurir Aktif */}
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

                    {/* Total Pengiriman */}
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

                    {/* Pengiriman Selesai */}
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

                {/* TABS */}
                <div className="bg-white rounded-xl border border-slate-200 mb-6">
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab("kurir")}
                            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === "kurir"
                                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                        >
                            <Icon icon="mdi:account-group" width={20} />
                            Daftar Kurir
                        </button>
                        <button
                            onClick={() => setActiveTab("pengiriman")}
                            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === "pengiriman"
                                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                        >
                            <Icon icon="mdi:truck-fast" width={20} />
                            Riwayat Pengiriman
                        </button>
                    </div>

                    {/* FILTER & ACTIONS */}
                    <div className="p-5 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            {/* Search */}
                            <div className="relative">
                                <Icon
                                    icon="mdi:magnify"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    width={20}
                                />
                                <input
                                    type="text"
                                    placeholder={activeTab === "kurir" ? "Cari kurir..." : "Cari pengiriman..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full sm:w-64 pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                />
                            </div>

                            {/* Area Filter (only for kurir tab) */}
                            {activeTab === "kurir" && (
                                <select
                                    value={selectedArea}
                                    onChange={(e) => setSelectedArea(e.target.value)}
                                    className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition cursor-pointer hover:bg-slate-50"
                                >
                                    {areaList.map((area) => (
                                        <option key={area} value={area}>
                                            {area}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {activeTab === "kurir" ? (
                                <button
                                    onClick={() => {
                                        setModalType("tambah-kurir");
                                        setShowModal(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                >
                                    <Icon icon="mdi:account-plus" width={20} />
                                    Tambah Kurir
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setModalType("tambah-pengiriman");
                                        setShowModal(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                >
                                    <Icon icon="mdi:truck-plus" width={20} />
                                    Buat Pengiriman
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* CONTENT */}
                {activeTab === "kurir" ? (
                    /* KURIR TABLE */
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Kurir
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Telepon
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Area
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Pengiriman
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Rating
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredKurir.map((kurir) => (
                                        <tr key={kurir.id} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={kurir.foto}
                                                        alt={kurir.nama}
                                                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                                                    />
                                                    <span className="font-semibold text-slate-800">
                                                        {kurir.nama}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600">{kurir.telepon}</td>
                                            <td className="px-5 py-4">
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border border-slate-200">
                                                    {kurir.area}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center font-bold text-slate-800">
                                                {kurir.totalPengiriman}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Icon icon="mdi:star" className="text-yellow-500" width={16} />
                                                    <span className="font-medium text-slate-700">{kurir.rating}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span
                                                    className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusBadge(kurir.status)}`}
                                                >
                                                    {getStatusLabel(kurir.status)}
                                                </span>
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
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* PENGIRIMAN TABLE */
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Item
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Jumlah
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Kurir
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Tujuan
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Tanggal
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredPengiriman.map((pengiriman) => (
                                        <tr key={pengiriman.id} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-4">
                                                <p className="font-semibold text-slate-800">{pengiriman.item}</p>
                                            </td>
                                            <td className="px-5 py-4 text-center font-bold text-slate-800">
                                                {pengiriman.jumlah}
                                            </td>
                                            <td className="px-5 py-4 text-slate-600">{pengiriman.kurir}</td>
                                            <td className="px-5 py-4">
                                                <p className="font-medium text-slate-700">{pengiriman.tujuan}</p>
                                                <p className="text-xs text-slate-500">{pengiriman.alamat}</p>
                                            </td>
                                            <td className="px-5 py-4 text-center text-slate-600">
                                                {pengiriman.tanggal}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span
                                                    className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusBadge(pengiriman.status)}`}
                                                >
                                                    {getStatusLabel(pengiriman.status)}
                                                </span>
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
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                                                        title="Update Status"
                                                    >
                                                        <Icon icon="mdi:update" width={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* MODAL */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Icon
                                        icon={
                                            modalType === "tambah-kurir"
                                                ? "mdi:account-plus"
                                                : "mdi:truck-plus"
                                        }
                                        className="text-blue-600"
                                        width={24}
                                    />
                                    {modalType === "tambah-kurir"
                                        ? "Tambah Kurir Baru"
                                        : "Buat Pengiriman Baru"}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
                                >
                                    <Icon icon="mdi:close" width={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {modalType === "tambah-kurir" ? (
                                    <>
                                        {/* Nama Kurir */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                Nama Kurir
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Masukkan nama kurir"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Telepon */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                No. Telepon
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="08xxxxxxxxxx"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Area */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                Area Tugas
                                            </label>
                                            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                                <option value="">-- Pilih Area --</option>
                                                <option value="Jakarta Pusat">Jakarta Pusat</option>
                                                <option value="Jakarta Selatan">Jakarta Selatan</option>
                                                <option value="Jakarta Timur">Jakarta Timur</option>
                                                <option value="Jakarta Barat">Jakarta Barat</option>
                                                <option value="Jakarta Utara">Jakarta Utara</option>
                                            </select>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Pilih Kurir */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                Pilih Kurir
                                            </label>
                                            <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                                <option value="">-- Pilih Kurir --</option>
                                                {dummyKurir
                                                    .filter((k) => k.status === "aktif")
                                                    .map((kurir) => (
                                                        <option key={kurir.id} value={kurir.id}>
                                                            {kurir.nama} - {kurir.area}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>

                                        {/* Item */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                Item APK
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nama item yang dikirim"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Jumlah */}
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

                                        {/* Tujuan */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                Tujuan
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Alamat pengiriman"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
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
                )}
            </div>
        </>
    );
}
