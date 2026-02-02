import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import Navbar from "../../components/Navbar";

/**
 * DASHBOARD KURIR APK
 * Halaman utama untuk kurir melihat tugas pengiriman
 */

// Dummy data - Tugas pengiriman dari admin
const dummyTugas = [
    {
        id: 1,
        nomorOrder: "APK-2026-0201",
        items: [
            { nama: "Spanduk Paslon", jumlah: 20 },
            { nama: "Stiker", jumlah: 100 },
        ],
        koordinator: {
            nama: "Budi Santoso",
            telepon: "081234567890",
            alamat: "Jl. Menteng Raya No. 45, Kec. Menteng, Jakarta Pusat",
        },
        tanggalOrder: "2026-02-02 08:30",
        deadline: "2026-02-02 14:00",
        status: "pending", // pending, dikirim, sampai, selesai
        prioritas: "tinggi",
        catatan: "Mohon diantar sebelum jam 2 siang, ada acara kampanye",
        isNew: true,
    },
    {
        id: 2,
        nomorOrder: "APK-2026-0202",
        items: [
            { nama: "Kaos Kampanye", jumlah: 50 },
            { nama: "Topi Kampanye", jumlah: 50 },
        ],
        koordinator: {
            nama: "Citra Dewi",
            telepon: "081234567891",
            alamat: "Jl. Kemang Raya No. 12, Kec. Kemang, Jakarta Selatan",
        },
        tanggalOrder: "2026-02-02 09:15",
        deadline: "2026-02-02 17:00",
        status: "dikirim",
        prioritas: "normal",
        catatan: "",
        isNew: false,
    },
    {
        id: 3,
        nomorOrder: "APK-2026-0203",
        items: [
            { nama: "Baliho 3x4m", jumlah: 5 },
        ],
        koordinator: {
            nama: "Dedi Kurnia",
            telepon: "081234567892",
            alamat: "Jl. Tebet Raya No. 88, Kec. Tebet, Jakarta Selatan",
        },
        tanggalOrder: "2026-02-01 14:00",
        deadline: "2026-02-02 12:00",
        status: "selesai",
        prioritas: "tinggi",
        catatan: "Sudah diterima koordinator",
        isNew: false,
    },
    {
        id: 4,
        nomorOrder: "APK-2026-0204",
        items: [
            { nama: "Bendera Partai", jumlah: 30 },
            { nama: "Umbul-umbul", jumlah: 20 },
        ],
        koordinator: {
            nama: "Eka Putri",
            telepon: "081234567893",
            alamat: "Jl. Kelapa Gading Boulevard, Kec. Kelapa Gading, Jakarta Utara",
        },
        tanggalOrder: "2026-02-02 10:00",
        deadline: "2026-02-03 10:00",
        status: "pending",
        prioritas: "normal",
        catatan: "",
        isNew: true,
    },
];

// Dummy notifikasi
const dummyNotifikasi = [
    {
        id: 1,
        pesan: "Order baru APK-2026-0201 dari Admin",
        waktu: "5 menit lalu",
        dibaca: false,
        tipe: "order_baru",
    },
    {
        id: 2,
        pesan: "Order APK-2026-0204 perlu segera dikirim",
        waktu: "30 menit lalu",
        dibaca: false,
        tipe: "reminder",
    },
    {
        id: 3,
        pesan: "Koordinator Budi konfirmasi terima barang",
        waktu: "1 jam lalu",
        dibaca: true,
        tipe: "konfirmasi",
    },
];

export default function KurirDashboard() {
    const [tugas, setTugas] = useState(dummyTugas);
    const [notifikasi, setNotifikasi] = useState(dummyNotifikasi);
    const [activeTab, setActiveTab] = useState("aktif"); // aktif, selesai
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTugas, setSelectedTugas] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);


    // Statistik untuk badge tab
    const tugasPending = tugas.filter((t) => t.status === "pending").length;
    const tugasDikirim = tugas.filter((t) => t.status === "dikirim").length;
    const notifBelumDibaca = notifikasi.filter((n) => !n.dibaca).length;

    // Filter tugas berdasarkan tab
    const filteredTugas = tugas.filter((t) => {
        if (activeTab === "aktif") return t.status !== "selesai";
        return t.status === "selesai";
    });

    // Handler update status
    const handleUpdateStatus = (tugasId, newStatus) => {
        setTugas((prev) =>
            prev.map((t) =>
                t.id === tugasId ? { ...t, status: newStatus, isNew: false } : t
            )
        );
        setShowConfirmModal(false);
        setSelectedTugas(null);
    };

    // Handler buka detail
    const handleOpenDetail = (tugasItem) => {
        setSelectedTugas(tugasItem);
        setShowDetailModal(true);
        // Mark as read
        setTugas((prev) =>
            prev.map((t) =>
                t.id === tugasItem.id ? { ...t, isNew: false } : t
            )
        );
    };

    // Handler konfirmasi action
    const handleConfirmAction = (tugasItem, action) => {
        setSelectedTugas(tugasItem);
        setConfirmAction(action);
        setShowConfirmModal(true);
    };

    // Get status styling
    const getStatusStyle = (status) => {
        const styles = {
            pending: {
                bg: "bg-yellow-100",
                text: "text-yellow-700",
                border: "border-yellow-200",
                icon: "mdi:clock-outline",
                label: "Menunggu",
            },
            dikirim: {
                bg: "bg-blue-100",
                text: "text-blue-700",
                border: "border-blue-200",
                icon: "mdi:truck-delivery",
                label: "Sedang Dikirim",
            },
            sampai: {
                bg: "bg-purple-100",
                text: "text-purple-700",
                border: "border-purple-200",
                icon: "mdi:map-marker-check",
                label: "Sampai Tujuan",
            },
            selesai: {
                bg: "bg-emerald-100",
                text: "text-emerald-700",
                border: "border-emerald-200",
                icon: "mdi:check-circle",
                label: "Selesai",
            },
        };
        return styles[status] || styles.pending;
    };

    // Get prioritas styling
    const getPrioritasStyle = (prioritas) => {
        if (prioritas === "tinggi") {
            return "bg-red-100 text-red-700 border-red-200";
        }
        return "bg-slate-100 text-slate-600 border-slate-200";
    };

    // Format waktu
    const formatWaktu = (dateStr) => {
        const date = new Date(dateStr.replace(" ", "T"));
        return date.toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Check deadline
    const isDeadlineSoon = (deadline) => {
        const now = new Date();
        const deadlineDate = new Date(deadline.replace(" ", "T"));
        const diffHours = (deadlineDate - now) / (1000 * 60 * 60);
        return diffHours <= 2 && diffHours > 0;
    };

    const isOverdue = (deadline) => {
        const now = new Date();
        const deadlineDate = new Date(deadline.replace(" ", "T"));
        return deadlineDate < now;
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6">
                {/* HEADER */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                <Icon icon="mdi:truck-fast" className="text-white" width={24} />
                            </div>
                            Dashboard Kurir
                        </h1>
                        <p className="text-slate-500 mt-1 ml-13">
                            Selamat datang! Kelola pengiriman APK Anda di sini.
                        </p>
                    </div>

                    {/* Notifikasi Button */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifPanel(!showNotifPanel)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm"
                        >
                            <div className="relative">
                                <Icon icon="mdi:bell" width={22} className="text-slate-600" />
                                {notifBelumDibaca > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                        {notifBelumDibaca}
                                    </span>
                                )}
                            </div>
                            <span className="text-slate-700 font-medium">Notifikasi</span>
                        </button>

                        {/* Notifikasi Panel */}
                        {showNotifPanel && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-slate-50">
                                    <h3 className="font-semibold text-slate-800">Notifikasi</h3>
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifikasi.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500">
                                            Tidak ada notifikasi
                                        </div>
                                    ) : (
                                        notifikasi.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition ${!notif.dibaca ? "bg-blue-50/50" : ""
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.tipe === "order_baru"
                                                            ? "bg-blue-100"
                                                            : notif.tipe === "reminder"
                                                                ? "bg-yellow-100"
                                                                : "bg-emerald-100"
                                                            }`}
                                                    >
                                                        <Icon
                                                            icon={
                                                                notif.tipe === "order_baru"
                                                                    ? "mdi:package-variant"
                                                                    : notif.tipe === "reminder"
                                                                        ? "mdi:alarm"
                                                                        : "mdi:check"
                                                            }
                                                            width={16}
                                                            className={
                                                                notif.tipe === "order_baru"
                                                                    ? "text-blue-600"
                                                                    : notif.tipe === "reminder"
                                                                        ? "text-yellow-600"
                                                                        : "text-emerald-600"
                                                            }
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-slate-700">{notif.pesan}</p>
                                                        <p className="text-xs text-slate-400 mt-1">{notif.waktu}</p>
                                                    </div>
                                                    {!notif.dibaca && (
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                {/* TAB NAVIGATION */}
                <div className="bg-white rounded-xl border border-slate-200 mb-6">
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab("aktif")}
                            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === "aktif"
                                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                        >
                            <Icon icon="mdi:clipboard-list" width={20} />
                            Tugas Aktif
                            {tugasPending + tugasDikirim > 0 && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                    {tugasPending + tugasDikirim}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("selesai")}
                            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === "selesai"
                                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                        >
                            <Icon icon="mdi:check-all" width={20} />
                            Riwayat Selesai
                        </button>
                    </div>
                </div>

                {/* TUGAS LIST */}
                <div className="space-y-4">
                    {filteredTugas.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                            <Icon
                                icon={activeTab === "aktif" ? "mdi:clipboard-check" : "mdi:history"}
                                width={48}
                                className="text-slate-300 mx-auto mb-4"
                            />
                            <h3 className="text-lg font-semibold text-slate-600">
                                {activeTab === "aktif"
                                    ? "Tidak ada tugas aktif"
                                    : "Belum ada riwayat pengiriman"}
                            </h3>
                            <p className="text-slate-400 mt-1">
                                {activeTab === "aktif"
                                    ? "Tugas baru akan muncul di sini"
                                    : "Riwayat pengiriman selesai akan tampil di sini"}
                            </p>
                        </div>
                    ) : (
                        filteredTugas.map((tugasItem) => {
                            const statusStyle = getStatusStyle(tugasItem.status);
                            const deadlineSoon = isDeadlineSoon(tugasItem.deadline);
                            const overdue = isOverdue(tugasItem.deadline) && tugasItem.status !== "selesai";

                            return (
                                <div
                                    key={tugasItem.id}
                                    className={`bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all ${tugasItem.isNew ? "ring-2 ring-blue-400 ring-offset-2" : ""
                                        } ${overdue ? "border-red-300" : ""}`}
                                >
                                    {/* Header Card */}
                                    <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                {tugasItem.isNew && (
                                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-md animate-pulse">
                                                        BARU
                                                    </span>
                                                )}
                                                <span className="font-bold text-slate-800 text-lg">
                                                    {tugasItem.nomorOrder}
                                                </span>
                                                <span
                                                    className={`px-2.5 py-1 text-xs font-bold rounded-md border ${getPrioritasStyle(
                                                        tugasItem.prioritas
                                                    )}`}
                                                >
                                                    {tugasItem.prioritas === "tinggi" ? "🔥 Prioritas Tinggi" : "Normal"}
                                                </span>
                                            </div>
                                            <div
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                                            >
                                                <Icon icon={statusStyle.icon} width={16} />
                                                <span className="text-sm font-semibold">{statusStyle.label}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Body Card */}
                                    <div className="p-4 md:p-5">
                                        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                                            {/* Items */}
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                    Items Pengiriman
                                                </h4>
                                                <div className="space-y-2">
                                                    {tugasItem.items.map((item, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
                                                        >
                                                            <span className="text-slate-700 font-medium">{item.nama}</span>
                                                            <span className="text-slate-500 font-bold">x{item.jumlah}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Koordinator */}
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                    Tujuan Pengiriman
                                                </h4>
                                                <div className="bg-slate-50 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Icon icon="mdi:account" className="text-slate-400" width={18} />
                                                        <span className="font-semibold text-slate-800">
                                                            {tugasItem.koordinator.nama}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Icon icon="mdi:phone" className="text-slate-400" width={18} />
                                                        <a
                                                            href={`tel:${tugasItem.koordinator.telepon}`}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            {tugasItem.koordinator.telepon}
                                                        </a>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <Icon
                                                            icon="mdi:map-marker"
                                                            className="text-slate-400 flex-shrink-0 mt-0.5"
                                                            width={18}
                                                        />
                                                        <span className="text-slate-600 text-sm">
                                                            {tugasItem.koordinator.alamat}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Catatan */}
                                        {tugasItem.catatan && (
                                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <Icon
                                                        icon="mdi:note-text"
                                                        className="text-yellow-600 flex-shrink-0"
                                                        width={18}
                                                    />
                                                    <p className="text-sm text-yellow-800">{tugasItem.catatan}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Deadline & Time Info */}
                                        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <Icon icon="mdi:clock-outline" width={16} />
                                                    <span>Order: {formatWaktu(tugasItem.tanggalOrder)}</span>
                                                </div>
                                                <div
                                                    className={`flex items-center gap-1.5 ${overdue
                                                        ? "text-red-600 font-semibold"
                                                        : deadlineSoon
                                                            ? "text-orange-600 font-semibold"
                                                            : "text-slate-500"
                                                        }`}
                                                >
                                                    <Icon
                                                        icon={overdue ? "mdi:alert-circle" : "mdi:flag"}
                                                        width={16}
                                                    />
                                                    <span>
                                                        Deadline: {formatWaktu(tugasItem.deadline)}
                                                        {overdue && " (Terlambat!)"}
                                                        {deadlineSoon && !overdue && " (Segera)"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                {/* Open Map */}
                                                <button
                                                    className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Buka Maps"
                                                >
                                                    <Icon icon="mdi:map-marker-radius" width={20} />
                                                </button>

                                                {/* Call */}
                                                <a
                                                    href={`tel:${tugasItem.koordinator.telepon}`}
                                                    className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                    title="Hubungi"
                                                >
                                                    <Icon icon="mdi:phone" width={20} />
                                                </a>

                                                {/* Detail */}
                                                <button
                                                    onClick={() => handleOpenDetail(tugasItem)}
                                                    className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                                                    title="Detail"
                                                >
                                                    <Icon icon="mdi:eye" width={20} />
                                                </button>

                                                {/* Status Actions */}
                                                {tugasItem.status === "pending" && (
                                                    <button
                                                        onClick={() => handleConfirmAction(tugasItem, "dikirim")}
                                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                                                    >
                                                        <Icon icon="mdi:truck-delivery" width={18} />
                                                        Mulai Kirim
                                                    </button>
                                                )}

                                                {tugasItem.status === "dikirim" && (
                                                    <button
                                                        onClick={() => handleConfirmAction(tugasItem, "selesai")}
                                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
                                                    >
                                                        <Icon icon="mdi:check-circle" width={18} />
                                                        Selesai
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* CONFIRM MODAL */}
                {showConfirmModal && selectedTugas && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
                            <div className="p-5 border-b border-slate-200 bg-slate-50">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Icon
                                        icon={confirmAction === "dikirim" ? "mdi:truck-delivery" : "mdi:check-circle"}
                                        className={confirmAction === "dikirim" ? "text-blue-600" : "text-emerald-600"}
                                        width={24}
                                    />
                                    {confirmAction === "dikirim" ? "Mulai Pengiriman?" : "Konfirmasi Selesai?"}
                                </h3>
                            </div>

                            <div className="p-6">
                                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                    <p className="text-sm text-slate-500 mb-1">Nomor Order</p>
                                    <p className="font-bold text-slate-800">{selectedTugas.nomorOrder}</p>
                                </div>

                                <p className="text-slate-600">
                                    {confirmAction === "dikirim"
                                        ? "Pastikan Anda sudah memuat semua barang dan siap berangkat mengantar ke lokasi koordinator."
                                        : "Pastikan barang sudah diterima oleh koordinator dan serahkan bukti serah terima."}
                                </p>

                                {confirmAction === "selesai" && (
                                    <div className="mt-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Upload Bukti Serah Terima (opsional)
                                        </label>
                                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 transition cursor-pointer">
                                            <Icon icon="mdi:camera" width={32} className="text-slate-400 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500">Klik untuk upload foto</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setSelectedTugas(null);
                                    }}
                                    className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(selectedTugas.id, confirmAction)}
                                    className={`px-5 py-2.5 text-white rounded-lg font-medium transition shadow-sm ${confirmAction === "dikirim"
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : "bg-emerald-600 hover:bg-emerald-700"
                                        }`}
                                >
                                    {confirmAction === "dikirim" ? "Ya, Mulai Kirim" : "Ya, Selesai"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DETAIL MODAL */}
                {showDetailModal && selectedTugas && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
                            <div className="sticky top-0 p-5 border-b border-slate-200 bg-white flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800">
                                    Detail Order {selectedTugas.nomorOrder}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        setSelectedTugas(null);
                                    }}
                                    className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
                                >
                                    <Icon icon="mdi:close" width={20} />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Status */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                                    <div
                                        className={`mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getStatusStyle(selectedTugas.status).bg
                                            } ${getStatusStyle(selectedTugas.status).text} ${getStatusStyle(selectedTugas.status).border
                                            }`}
                                    >
                                        <Icon icon={getStatusStyle(selectedTugas.status).icon} width={16} />
                                        <span className="font-semibold">
                                            {getStatusStyle(selectedTugas.status).label}
                                        </span>
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Items</label>
                                    <div className="mt-2 space-y-2">
                                        {selectedTugas.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg border border-slate-200"
                                            >
                                                <span className="text-slate-700 font-medium">{item.nama}</span>
                                                <span className="text-slate-600 font-bold">x{item.jumlah}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Koordinator */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">
                                        Penerima (Koordinator)
                                    </label>
                                    <div className="mt-2 bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <p className="font-semibold text-slate-800">
                                            {selectedTugas.koordinator.nama}
                                        </p>
                                        <p className="text-blue-600">{selectedTugas.koordinator.telepon}</p>
                                        <p className="text-slate-600 text-sm mt-1">
                                            {selectedTugas.koordinator.alamat}
                                        </p>
                                    </div>
                                </div>

                                {/* Waktu */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">
                                            Waktu Order
                                        </label>
                                        <p className="mt-1 text-slate-700">
                                            {formatWaktu(selectedTugas.tanggalOrder)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Deadline</label>
                                        <p className="mt-1 text-slate-700">{formatWaktu(selectedTugas.deadline)}</p>
                                    </div>
                                </div>

                                {/* Catatan */}
                                {selectedTugas.catatan && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                                        <p className="mt-1 text-slate-700 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                            {selectedTugas.catatan}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-3">
                                <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(
                                        selectedTugas.koordinator.alamat
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                                >
                                    <Icon icon="mdi:map-marker" width={18} />
                                    Buka Maps
                                </a>
                                <a
                                    href={`tel:${selectedTugas.koordinator.telepon}`}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                                >
                                    <Icon icon="mdi:phone" width={18} />
                                    Hubungi
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
