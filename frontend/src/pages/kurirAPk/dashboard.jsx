import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import api from "../../lib/axios";
import Navbar from "../../components/Navbar";

/**
 * DASHBOARD KURIR APK
 * Halaman utama untuk kurir melihat tugas pengiriman
 */

// Dummy data - Tugas pengiriman dari admin
// Dummy data removed as real API is integrated

export default function KurirDashboard() {
    const [activeTab, setActiveTab] = useState("aktif");
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTugas, setSelectedTugas] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);

    // React Query for Tasks
    const { data: tugasData, isLoading: isLoadingTugas, refetch: refetchTugas } = useQuery({
        queryKey: ['apkRequests'],
        queryFn: async () => {
            const res = await api.get('/apk-requests');
            return res.data.data; // Assuming standard structure
        },
    });

    // React Query for Notifications
    const { data: notifData, refetch: refetchNotif } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const res = await api.get('/notifications');
            return res.data.data?.data || res.data.data || [];
        },
        refetchInterval: 30000,
    });

    const queryClient = useQueryClient();

    // Mutations
    const pickupMutation = useMutation({
        mutationFn: (id) => api.post(`/apk-requests/${id}/pickup`),
        onSuccess: () => {
            toast.success("Status berhasil diperbarui: Sedang Dikirim");
            queryClient.invalidateQueries(['apkRequests']);
            refetchTugas();
            setShowConfirmModal(false);
            setSelectedTugas(null);
        },
        onError: (err) => {
            toast.error("Gagal memperbarui status");
            console.error(err);
        }
    });

    const arriveMutation = useMutation({
        mutationFn: (id) => api.post(`/apk-requests/${id}/arrive`),
        onSuccess: () => {
            toast.success("Status berhasil diperbarui: Sampai Tujuan");
            queryClient.invalidateQueries(['apkRequests']);
            refetchTugas();
            setShowConfirmModal(false);
            setSelectedTugas(null);
        },
        onError: (err) => {
            toast.error("Gagal memperbarui status");
            console.error(err);
        }
    });

    const tugas = tugasData || [];
    const notifikasi = notifData || [];

    // Statistik untuk badge tab
    // Status mapping:
    // APPROVED -> Pending (Menunggu)
    // PICKED_UP -> Dikirim (Sedang Dikirim)
    // ARRIVED -> Selesai (Sampai/Selesai bagi kurir)
    // DELIVERED -> Selesai (Diterima Koordinator)

    // Helper to map backend status to UI status
    const mapStatus = (statusObj) => {
        const code = statusObj?.code || 'PENDING';
        if (code === 'APPROVED') return 'pending';
        if (code === 'PICKED_UP') return 'dikirim';
        if (code === 'ARRIVED' || code === 'DELIVERED') return 'selesai';
        return 'unknown';
    };

    const tugasPending = tugas.filter((t) => mapStatus(t.status) === "pending").length;
    const tugasDikirim = tugas.filter((t) => mapStatus(t.status) === "dikirim").length;
    const notifBelumDibaca = notifikasi.filter((n) => !n.read_at).length;

    // Filter tugas berdasarkan tab
    const filteredTugas = tugas.filter((t) => {
        const s = mapStatus(t.status);
        if (activeTab === "aktif") return s === "pending" || s === "dikirim";
        return s === "selesai";
    });

    // Handler update status
    const handleUpdateStatus = (tugasId, newStatus) => {
        // newStatus is 'dikirim' or 'selesai' from UI
        if (newStatus === 'dikirim') {
            pickupMutation.mutate(tugasId);
        } else if (newStatus === 'selesai') {
            arriveMutation.mutate(tugasId);
        }
    };

    // Handler buka detail
    const handleOpenDetail = (tugasItem) => {
        setSelectedTugas(tugasItem);
        setShowDetailModal(true);
    };

    // Handler konfirmasi action
    const handleConfirmAction = (tugasItem, action) => {
        setSelectedTugas(tugasItem);
        setConfirmAction(action);
        setShowConfirmModal(true);
    };

    // Get status styling
    const getStatusStyle = (statusObj) => {
        const code = statusObj?.code || 'PENDING';
        const uiStatus = mapStatus(statusObj);

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
            selesai: {
                bg: "bg-emerald-100",
                text: "text-emerald-700",
                border: "border-emerald-200",
                icon: "mdi:check-circle",
                label: "Selesai / Sampai",
            },
        };
        return styles[uiStatus] || styles.pending;
    };

    // Get prioritas styling - APkRequest might not have priority field, defaulting
    const getPrioritasStyle = (prioritas) => {
        // Assuming no priority field in backend for now, or check standard
        return "bg-slate-100 text-slate-600 border-slate-200";
    };

    // Format waktu
    const formatWaktu = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Check deadline (pickup_scheduled_at)
    const isDeadlineSoon = (deadline) => {
        if (!deadline) return false;
        const now = new Date();
        const deadlineDate = new Date(deadline);
        const diffHours = (deadlineDate - now) / (1000 * 60 * 60);
        return diffHours <= 2 && diffHours > 0;
    };

    const isOverdue = (deadline) => {
        if (!deadline) return false;
        const now = new Date();
        const deadlineDate = new Date(deadline);
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
                            const deadline = tugasItem.pickup_scheduled_at;
                            const deadlineSoon = isDeadlineSoon(deadline);
                            const overdue = isOverdue(deadline) && mapStatus(tugasItem.status) !== "selesai";

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
                                                    {tugasItem.request_no}
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
                                                            <span className="text-slate-700 font-medium">{item.item?.name || 'Unknown Item'}</span>
                                                            <span className="text-slate-500 font-bold">x{item.qty}</span>
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
                                                            {tugasItem.coordinator?.nama || '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Icon icon="mdi:phone" className="text-slate-400" width={18} />
                                                        <a
                                                            href={`tel:${tugasItem.coordinator?.no_hp}`}
                                                            className="text-blue-600 hover:underline"
                                                        >
                                                            {tugasItem.coordinator?.no_hp || '-'}
                                                        </a>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <Icon
                                                            icon="mdi:map-marker"
                                                            className="text-slate-400 flex-shrink-0 mt-0.5"
                                                            width={18}
                                                        />
                                                        <span className="text-slate-600 text-sm">
                                                            {tugasItem.pickup_address || tugasItem.coordinator?.alamat || '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Catatan (if any) */}
                                        {tugasItem.note && (
                                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                    <Icon
                                                        icon="mdi:note-text"
                                                        className="text-yellow-600 flex-shrink-0"
                                                        width={18}
                                                    />
                                                    <p className="text-sm text-yellow-800">{tugasItem.note}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Deadline & Time Info */}
                                        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <Icon icon="mdi:clock-outline" width={16} />
                                                    <span>Order: {formatWaktu(tugasItem.created_at)}</span>
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
                                                        Deadline: {formatWaktu(deadline)}
                                                        {overdue && " (Terlambat!)"}
                                                        {deadlineSoon && !overdue && " (Segera)"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                {/* Open Map */}
                                                <a
                                                    href={`https://maps.google.com/?q=${encodeURIComponent(
                                                        tugasItem.pickup_address || tugasItem.coordinator?.alamat || ''
                                                    )}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Buka Maps"
                                                >
                                                    <Icon icon="mdi:map-marker-radius" width={20} />
                                                </a>

                                                {/* Call */}
                                                <a
                                                    href={`tel:${tugasItem.coordinator?.no_hp}`}
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
                                                {mapStatus(tugasItem.status) === "pending" && (
                                                    <button
                                                        onClick={() => handleConfirmAction(tugasItem, "dikirim")}
                                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                                                    >
                                                        <Icon icon="mdi:truck-delivery" width={18} />
                                                        Mulai Kirim
                                                    </button>
                                                )}

                                                {mapStatus(tugasItem.status) === "dikirim" && (
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
                                    <p className="font-bold text-slate-800">{selectedTugas.request_no}</p>
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
                                    Detail Order {selectedTugas.request_no}
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
                                                <span className="text-slate-700 font-medium">{item.item?.name || 'Unknown Item'}</span>
                                                <span className="text-slate-600 font-bold">x{item.qty}</span>
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
                                            {selectedTugas.coordinator?.nama || '-'}
                                        </p>
                                        <p className="text-blue-600">{selectedTugas.coordinator?.no_hp || '-'}</p>
                                        <p className="text-slate-600 text-sm mt-1">
                                            {selectedTugas.pickup_address || selectedTugas.coordinator?.alamat || '-'}
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
                                            {formatWaktu(selectedTugas.created_at)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Deadline</label>
                                        <p className="mt-1 text-slate-700">{formatWaktu(selectedTugas.pickup_scheduled_at)}</p>
                                    </div>
                                </div>

                                {/* Catatan */}
                                {selectedTugas.note && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Catatan</label>
                                        <p className="mt-1 text-slate-700 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                            {selectedTugas.note}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-3">
                                <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(
                                        selectedTugas.pickup_address || selectedTugas.coordinator?.alamat || ''
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                                >
                                    <Icon icon="mdi:map-marker" width={18} />
                                    Buka Maps
                                </a>
                                <a
                                    href={`tel:${selectedTugas.coordinator?.no_hp}`}
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
