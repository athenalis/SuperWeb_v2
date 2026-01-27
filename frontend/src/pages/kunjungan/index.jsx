import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import { toast } from "react-hot-toast";
import { offlineDb } from "../../lib/offlineDb";
import { syncService } from "../../lib/syncService";

// === INLINE CONFIRMATION MODAL COMPONENTS ===
// Menggunakan Portal dan Style persis seperti Hapus Relawan
const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Hapus Kunjungan",
    confirmLabel = "Hapus",
    cancelLabel = "Batal",
    loading = false,
    namaTag // Nama object yang dihapus
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!loading ? onClose : undefined}
            />

            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 z-10">
                <h2 className="text-xl font-semibold text-slate-800 mb-2">
                    {title}
                </h2>

                <p className="text-slate-600 mb-6">
                    Apakah Anda yakin ingin menghapus data kunjungan atas nama
                    <span className="font-semibold text-slate-800">
                        {" "}“{namaTag}”
                    </span>
                    ?
                    <br />
                    <span className="text-sm text-red-500 mt-2 block">
                        Aksi ini tidak dapat dibatalkan.
                    </span>
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg border border-slate-300
                 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>

                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-5 py-2 rounded-lg bg-red-600 text-white
                 hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <Icon icon="mdi:loading" className="animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.getElementById("modal-root") || document.body
    );
};

export default function KunjunganIndex() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const role = localStorage.getItem("role");

    // Batch Mode Props
    const isBatchMode = searchParams.get("batch") === "true";
    const batchLimit = parseInt(searchParams.get("limit")) || 5;

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");

    // === DELETE MODAL STATE ===
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        id: null,
        nama: ""
    });
    const [isDeleting, setIsDeleting] = useState(false);

    // === STATS ===
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        accepted: 0,
    });

    const [offlineItems, setOfflineItems] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // State untuk expand baris (menyimpan array ID yang expanded)
    const [expandedRows, setExpandedRows] = useState([]);

    const toggleExpand = (id) => {
        setExpandedRows(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    // Initial Load & Listeners
    useEffect(() => {
        fetchKunjungan();
        loadOfflineData();

        // Listener for Auto-Sync completion
        const handleSyncComplete = () => {
            loadOfflineData();
            fetchKunjungan();
            setLastSyncTime(new Date());
        };
        window.addEventListener('sync-complete', handleSyncComplete);

        // Network Status Listeners
        const handleStatusChange = () => {
            const online = navigator.onLine;
            setIsOnline(online);
            if (online) {
                toast.success("Koneksi kembali! Mencoba sinkronisasi...");
                // Trigger sync immediately when back online handled by syncService listener
                // But we can also manually trigger just in case
            } else {
                toast("Anda sedang offline", { icon: "📶" });
            }
        };
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        return () => {
            window.removeEventListener('sync-complete', handleSyncComplete);
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, [statusFilter, searchParams]);

    const loadOfflineData = async () => {
        try {
            const items = await offlineDb.getAllVisits();
            // Filter only pending items
            setOfflineItems(items.filter(i => i.sync_status === 'pending'));
        } catch (err) {
            console.error("Failed to load offline items", err);
        }
    };

    const handleSync = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        const tid = toast.loading("Sinkronisasi data...");
        try {
            await syncService.syncPendingVisits();
            await loadOfflineData();
            await fetchKunjungan();
        } catch (err) {
            toast.error("Gagal sinkronisasi data");
        } finally {
            setIsSyncing(false);
            toast.dismiss(tid);
        }
    };

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (search !== undefined && search !== "") {
                fetchKunjungan(1, search);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    const fetchKunjungan = async (page = 1, searchQuery = search) => {
        setLoading(true);
        try {
            let url = `/kunjungan?page=${page}`;
            if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
            if (statusFilter !== "all") url += `&status=${statusFilter}`;

            // Batch param handling (with default limit 5 as requested, using smart grid to fill spaces)
            const limit = isBatchMode ? batchLimit : 5;
            url += `&per_page=${limit}`;

            if (isBatchMode) {
                if (searchParams.get("relawan_id")) {
                    url += `&relawan_id=${searchParams.get("relawan_id")}`;
                }
            }

            const res = await api.get(url);

            if (res.data.success) {
                setData(res.data.data.data);

                // Use stats from server response
                if (res.data.stats) {
                    setStats(res.data.stats);
                }

                setPagination({
                    current_page: res.data.data.current_page,
                    last_page: res.data.data.last_page,
                    total: res.data.data.total,
                });
            }
        } catch (err) {
            console.error("Fetch kunjungan failed:", err);
            setError("Gagal mengambil data kunjungan");
        } finally {
            setLoading(false);
        }
    };

    const handleNextBatch = async () => {
        try {
            setLoading(true);
            const res = await api.get('/kunjungan/batch/next');
            if (res.data.success) {
                toast.success(`Batch berikutnya: ${res.data.data.count} kunjungan dari ${res.data.data.relawan_nama}`);
                navigate(res.data.data.redirect_url);
                // Force reload params logic
                window.location.href = res.data.data.redirect_url;
            } else {
                toast.error(res.data.message || "Tidak ada batch lagi pending.");
                navigate('/kunjungan'); // Exit batch mode
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat batch berikutnya");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchKunjungan(1, search);
    };

    // === DELETE HANDLERS ===
    const openDeleteModal = (id, nama) => {
        setDeleteModal({ isOpen: true, id, nama });
    };

    const closeDeleteModal = () => {
        setDeleteModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.id) return;

        setIsDeleting(true);
        try {
            // Check if it's an offline ID
            if (deleteModal.id.toString().startsWith('off_')) {
                await offlineDb.deleteVisit(deleteModal.id);
                toast.success("Data offline berhasil dihapus", {
                    icon: '🗑️',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
                setOfflineItems(offlineItems.filter(item => item.offline_id !== deleteModal.id));
                closeDeleteModal();
                return;
            }

            // Normal server delete
            const res = await api.delete(`/kunjungan/${deleteModal.id}`);
            if (res.data.success) {
                toast.success("Data kunjungan berhasil dihapus", {
                    icon: '🗑️',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
                setData(data.filter(item => item.id !== deleteModal.id));
                closeDeleteModal();
            }
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Gagal menghapus data kunjungan");
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        try {
            return new Intl.DateTimeFormat("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }).format(new Date(dateStr));
        } catch {
            return dateStr;
        }
    };

    // === STATUS STYLE ===
    const getStatusColor = (item) => {
        if (item.sync_status === 'pending') return "border-blue-500 text-blue-700 bg-blue-50";
        switch (item.status_verifikasi) {
            case "accepted":
                return "border-green-500 text-green-700 bg-green-50";
            case "rejected":
                return "border-red-500 text-red-700 bg-red-50";
            default:
                if (item.status === 'draft') return "border-slate-400 text-slate-600 bg-slate-50";
                return "border-amber-500 text-amber-700 bg-amber-50";
        }
    };

    const getStatusLabel = (item) => {
        if (item.sync_status === 'pending') return "📶 Menunggu Sinkron";
        if (item.status === 'draft') return "Belum Selesai";
        switch (item.status_verifikasi) {
            case "accepted":
                return "Disetujui";
            case "rejected":
                return "Ditolak";
            default:
                return "Pending";
        }
    };

    const displayData = [...offlineItems, ...data];

    return (
        <div className="space-y-4 md:space-y-6 text-slate-900 overflow-x-hidden">

            {/* DELETE MODAL */}
            {/* OFFLINE BANNER */}
            {!isOnline && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r shadow-sm flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <Icon icon="mdi:wifi-off" className="text-amber-500 text-2xl" />
                        <div>
                            <p className="font-bold text-amber-800">Mode Offline</p>
                            <p className="text-sm text-amber-700">Perubahan akan disimpan di perangkat dan disinkronkan saat online.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={closeDeleteModal}
                onConfirm={handleConfirmDelete}
                title="Hapus Kunjungan"
                confirmLabel="Hapus"
                cancelLabel="Batal"
                loading={isDeleting}
                namaTag={deleteModal.nama}
            />

            {/* ===== SUMMARY CARDS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">

                {/* Total */}
                <div className="relative p-4 md:p-6 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl md:rounded-2xl shadow-lg shadow-blue-200 text-white overflow-hidden group">
                    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Icon icon="mdi:folder-account" width="100" />
                    </div>
                    <h3 className="text-blue-100 font-medium text-sm uppercase tracking-wider mb-1">Total Kunjungan</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl md:text-4xl font-bold">{stats.total}</span>
                        <span className="text-blue-200 text-sm">Data</span>
                    </div>
                </div>

                {/* Pending */}
                <div className="relative p-4 md:p-6 bg-white border border-amber-100 rounded-xl md:rounded-2xl shadow-lg shadow-amber-50 group">
                    <div className="absolute right-4 top-4 bg-amber-50 p-3 rounded-full text-amber-500">
                        <Icon icon="mdi:clock-outline" width="24" />
                    </div>
                    <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Menunggu Verifikasi</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl md:text-4xl font-bold text-slate-800">{stats.pending}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pending</span>
                    </div>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(stats.pending / (stats.total || 1)) * 100}%` }}></div>
                    </div>
                </div>

                {/* Accepted */}
                <div className="relative p-4 md:p-6 bg-white border border-green-100 rounded-xl md:rounded-2xl shadow-lg shadow-green-50 group">
                    <div className="absolute right-4 top-4 bg-green-50 p-3 rounded-full text-green-500">
                        <Icon icon="mdi:check-decagram" width="24" />
                    </div>
                    <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Disetujui</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl md:text-4xl font-bold text-slate-800">{stats.accepted}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">Verified</span>
                    </div>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${(stats.accepted / (stats.total || 1)) * 100}%` }}></div>
                    </div>
                </div>

            </div>

            {/* HEADER */}
            <div className="bg-white rounded-lg p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-blue-900">Data Kunjungan</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Daftar aktivitas kunjungan lapangan Anda
                    </p>
                </div>

                {role === "relawan" && (
                    <div className="flex gap-2">
                        {offlineItems.length > 0 && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className="bg-amber-100 text-amber-700 px-6 py-3 rounded-lg hover:bg-amber-200 transition-all shadow-md flex items-center gap-2 whitespace-nowrap border border-amber-200"
                            >
                                <Icon icon={isSyncing ? "mdi:loading" : "mdi:sync"} className={isSyncing ? "animate-spin" : ""} width="22" />
                                Sync ({offlineItems.length})
                            </button>
                        )}
                        <button
                            onClick={() => {
                                // Explicitly clear drafts to ensure fresh start
                                localStorage.removeItem("kunjungan_draft_v1");
                                localStorage.removeItem("kunjungan_draft_step1");
                                localStorage.removeItem("kunjungan_draft_members");
                                navigate("/kunjungan/anggota");
                            }}
                            className="bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-blue-800 transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
                        >
                            <Icon icon="mdi:plus" width="22" />
                            Buat Kunjungan
                        </button>
                    </div>
                )}

            </div>


            {/* FILTER & SEARCH TOOLBAR */}
            {isBatchMode && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg mb-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Icon icon="mdi:buffer" width="24" />
                            Mode Verifikasi Batch
                        </h3>
                        <p className="text-indigo-100 text-sm">
                            Menampilkan {data.length} kunjungan untuk relawan ini.
                        </p>
                    </div>
                    <div>
                        {data.length === 0 || (statusFilter === 'pending' && data.length === 0) ? (
                            <button
                                onClick={handleNextBatch}
                                className="bg-white text-indigo-600 font-bold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-50 transition-colors animate-pulse flex items-center gap-2"
                            >
                                Batch Berikutnya <Icon icon="mdi:arrow-right" />
                            </button>
                        ) : (
                            <span className="bg-white/20 py-1 px-3 rounded text-sm text-white">
                                Selesaikan pending untuk lanjut
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-sm border border-slate-100">
                {/* Status Filter - Dropdown */}
                <div className="relative w-full md:w-64">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full appearance-none px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none cursor-pointer"
                    >
                        <option value="all">Semua ({stats.total})</option>
                        <option value="pending">Pending ({stats.pending})</option>
                        <option value="accepted">Disetujui ({stats.accepted})</option>
                        <option value="rejected">Ditolak ({stats.total - stats.pending - stats.accepted})</option>
                    </select>
                    <Icon
                        icon="mdi:chevron-down"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        width="20"
                    />
                </div>

                <form onSubmit={handleSearch} className="relative w-full md:w-80 group">
                    <input
                        type="text"
                        placeholder="Cari Nama..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    />
                    <Icon
                        icon="mdi:magnify"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
                        width="20"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => { setSearch(""); fetchKunjungan(1, ""); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                        >
                            <Icon icon="mdi:close-circle" width="16" />
                        </button>
                    )}
                </form>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white rounded-xl shadow p-20 text-center">
                    <div className="animate-spin inline-block w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full mb-4"></div>
                    <p className="text-slate-500">Memuat data kunjungan...</p>
                </div>
            ) : error ? (
                <div className="bg-white rounded-xl shadow p-10 text-center border-t-4 border-red-500">
                    <Icon icon="mdi:alert-circle-outline" width="48" className="mx-auto text-red-500 mb-2" />
                    <h3 className="text-lg font-semibold text-slate-800">{error}</h3>
                    <button onClick={() => fetchKunjungan()} className="mt-4 px-4 py-2 bg-blue-100 text-blue-900 rounded-lg hover:bg-blue-200">
                        Coba Lagi
                    </button>
                </div>

            ) : data.length === 0 ? (
                <div className="bg-white rounded-xl shadow p-10 text-center">
                    <Icon icon="mdi:map-marker-path" width="64" className="mx-auto text-slate-300 mb-4" />
                    <h2 className="text-lg font-semibold text-slate-700">Belum ada data kunjungan</h2>
                    <p className="text-sm text-slate-500 mt-2">
                        Silakan buat kunjungan baru untuk mulai mencatat aktivitas lapangan.
                    </p>
                </div>

            ) : (
                <div className="bg-slate-50 rounded-2xl p-4 md:p-6">

                    {/* DESKTOP SMART GRID (6 Columns Base) */}
                    <div className="hidden md:grid grid-cols-1 lg:grid-cols-6 gap-5">
                        {displayData.map((item, index) => {
                            // Smart Span Logic for 5 items (or any count)
                            // Goal: Fill the row perfectly.
                            // If Total 5: First 3 are col-span-2 (33%), Last 2 are col-span-3 (50%)
                            const total = displayData.length;
                            let spanClass = "lg:col-span-2"; // Default 3 per row

                            if (total === 5) {
                                if (index >= 3) spanClass = "lg:col-span-3";
                            } else if (total === 4) {
                                spanClass = "lg:col-span-3"; // 2 per row
                            } else if (total === 2) {
                                spanClass = "lg:col-span-3";
                            } else if (total === 1) {
                                spanClass = "lg:col-span-6 max-w-2xl mx-auto w-full";
                            }

                            return (
                                <div
                                    key={item.id || item.offline_id}
                                    onClick={() => {
                                        if (item.sync_status === 'pending') {
                                            toast.info("Data ini disimpan offline. Silakan klik tombol 'Sync' untuk mengunggah.");
                                            return;
                                        }
                                        window.location.href = `/kunjungan/${item.id}`;
                                    }}
                                    className={`${spanClass} bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all relative overflow-hidden`}
                                >
                                    {/* Status Badge */}
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${getStatusColor(item)}`}>
                                                {getStatusLabel(item)}
                                            </span>
                                            {item.status === 'draft' && (
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    (Tap pendaftaran)
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20 text-white">
                                            <Icon icon="mdi:account-group" width="24" />
                                        </div>
                                        <div className="pr-20">
                                            <h3 className="font-bold text-lg text-slate-900 mb-1 leading-tight line-clamp-1">
                                                {item.nama}
                                            </h3>
                                            <div className="flex items-center gap-2 text-slate-500 text-xs font-mono bg-slate-100 px-2 py-1 rounded w-fit">
                                                <Icon icon="mdi:card-account-details" width="14" />
                                                {item.nik}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Icon icon="mdi:map-marker" width="16" className="text-red-500 flex-shrink-0" />
                                            <p className="truncate text-xs font-medium">{item.alamat}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <div className="flex items-center gap-1.5">
                                                <Icon icon="mdi:calendar" width="14" />
                                                {formatDate(item.created_at)}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Icon icon="mdi:account" width="14" />
                                                {item.family_form?.members_count || 0} Anggota
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.location.href = `/kunjungan/${item.id}`;
                                            }}
                                            className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                                            title="Lihat Detail"
                                        >
                                            <Icon icon="mdi:eye" width="20" />
                                        </button>

                                        {/* Edit Button (Only Pending) */}
                                        {item.status_verifikasi === 'pending' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.location.href = `/kunjungan/${item.id}/edit`;
                                                }}
                                                className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-colors"
                                                title="Edit Data"
                                            >
                                                <Icon icon="mdi:pencil" width="20" />
                                            </button>
                                        )}

                                        {role === "relawan" && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const deleteId = item.sync_status === 'pending' ? item.offline_id : item.id;
                                                    openDeleteModal(deleteId, item.nama);
                                                }}
                                                className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
                                                title="Hapus Data"
                                            >
                                                <Icon icon="mdi:trash-can" width="20" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Expandable Members */}
                                    {item.family_form?.members?.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                                                className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors w-full"
                                            >
                                                <Icon
                                                    icon="mdi:chevron-down"
                                                    width="16"
                                                    className={`transition-transform duration-200 ${expandedRows.includes(item.id) ? 'rotate-180' : ''}`}
                                                />
                                                <span>{expandedRows.includes(item.id) ? 'Sembunyikan' : 'Lihat'} Anggota Keluarga ({item.family_form.members.length})</span>
                                            </button>

                                            {expandedRows.includes(item.id) && (
                                                <div className="mt-3 space-y-2 pl-2">
                                                    {item.family_form.members.map((member) => (
                                                        <div key={member.id} className="bg-slate-50/50 rounded-lg p-2 border border-slate-100 text-xs">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-semibold text-slate-700">{member.nama}</span>
                                                                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold capitalize">
                                                                    {member.hubungan}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                                <span className="font-mono">{member.nik}</span>
                                                                <span>•</span>
                                                                <span>{member.umur} Thn</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* MOBILE LIST - OPTIMIZED FOR LOW-END DEVICES */}
                    <div className="md:hidden space-y-3">
                        {
                            displayData.map(item => (
                                <div
                                    key={item.id || item.offline_id}
                                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm active:shadow transition-shadow"
                                >

                                    <div
                                        className="cursor-pointer active:bg-slate-50 rounded-lg -m-1 p-1"
                                        onClick={() => {
                                            if (item.sync_status === 'pending') {
                                                toast.info("Data offline. Silakan sinkronkan terlebih dahulu.");
                                                return;
                                            }
                                            if (item.status === 'draft') {
                                                window.location.href = `/kunjungan/${item.id}/edit`;
                                            } else {
                                                window.location.href = `/kunjungan/${item.id}`;
                                            }
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-base text-slate-900 mb-1 truncate">{item.nama}</h3>
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <Icon icon="mdi:card-account-details" width="14" className="text-blue-600 flex-shrink-0" />
                                                    <p className="text-xs font-mono truncate">{item.nik}</p>
                                                </div>
                                            </div>

                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ml-2 flex-shrink-0 ${getStatusColor(item)}`}>
                                                {getStatusLabel(item)}
                                            </span>
                                        </div>

                                        <div className="flex items-start gap-1.5 text-slate-600 bg-slate-50 rounded-lg p-2 mb-2">
                                            <Icon icon="mdi:map-marker" width="14" className="text-green-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs line-clamp-2 leading-relaxed">{item.alamat}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <Icon icon="mdi:calendar-outline" width="12" />
                                                <span className="font-semibold">
                                                    {new Date(item.created_at).toLocaleDateString("id-ID", { day: '2-digit', month: 'short' })}
                                                </span>
                                            </div>
                                            <span>•</span>
                                            <div className="flex items-center gap-1">
                                                <Icon icon="mdi:account-group" width="12" />
                                                <span className="font-semibold">{item.family_form?.members_count || 0}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {item.status === 'draft' ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.location.href = `/kunjungan/${item.id}/edit`;
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-bold shadow-sm active:scale-95"
                                                >
                                                    <Icon icon="mdi:pencil-outline" width="14" />
                                                    Lanjut
                                                </button>
                                            ) : (
                                                item.status_verifikasi === 'pending' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.location.href = `/kunjungan/${item.id}/edit`;
                                                        }}
                                                        className="p-2.5 bg-amber-50 text-amber-600 rounded-lg active:bg-amber-100"
                                                    >
                                                        <Icon icon="mdi:pencil-outline" width="18" />
                                                    </button>
                                                )
                                            )}

                                            {role === "relawan" && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const deleteId = item.sync_status === 'pending' ? item.offline_id : item.id;
                                                        openDeleteModal(deleteId, item.nama);
                                                    }}
                                                    className="p-2.5 bg-red-50 text-red-600 rounded-lg active:bg-red-100"
                                                >
                                                    <Icon icon="mdi:trash-can" width="18" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* TOGGLE ANGGOTA MOBILE - Simplified */}
                                    {item.family_form?.members?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                                                className="flex items-center gap-1 text-xs font-bold text-blue-600 active:text-blue-800"
                                            >
                                                <Icon icon={expandedRows.includes(item.id) ? "mdi:chevron-up" : "mdi:chevron-down"} width="18" />
                                                {expandedRows.includes(item.id) ? "Sembunyikan" : `Lihat ${item.family_form.members.length} Anggota`}
                                            </button>

                                            {expandedRows.includes(item.id) && (
                                                <div className="mt-2 space-y-1.5">
                                                    {item.family_form.members.map((member) => (
                                                        <div key={member.id} className="bg-slate-50 rounded-lg p-2 text-xs border border-slate-100">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="font-semibold text-slate-700 truncate flex-1">{member.nama}</span>
                                                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold capitalize ml-1">
                                                                    {member.hubungan}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                                <span className="font-mono truncate">{member.nik}</span>
                                                                <span>•</span>
                                                                <span>{member.umur} Thn</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                            ))
                        }
                    </div >

                    {/* PAGINATION (Styled) */}
                    {
                        pagination && (
                            <div className="flex justify-center mt-6 mb-8 px-4">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 flex items-center gap-2">
                                    {/* PREV */}
                                    <button
                                        disabled={pagination.current_page === 1}
                                        onClick={() => fetchKunjungan(pagination.current_page - 1)}
                                        className="h-9 px-3 bg-transparent text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl text-xs font-bold disabled:opacity-30 disabled:hover:bg-transparent transition-all active:scale-95 flex items-center gap-1"
                                    >
                                        <Icon icon="mdi:chevron-left" width="18" />
                                        <span className="hidden sm:inline">Prev</span>
                                    </button>

                                    {/* DIVIDER Mobile */}
                                    <div className="md:hidden w-px h-5 bg-slate-200 mx-1"></div>

                                    {/* DESKTOP PAGE NUMBERS */}
                                    <div className="hidden md:flex gap-1">
                                        {(() => {
                                            const currentPage = pagination.current_page;
                                            const lastPage = pagination.last_page;
                                            const range = [];
                                            const delta = 1;

                                            for (let i = Math.max(2, currentPage - delta); i <= Math.min(lastPage - 1, currentPage + delta); i++) {
                                                range.push(i);
                                            }

                                            if (currentPage - delta > 2) range.unshift("...");
                                            if (currentPage + delta < lastPage - 1) range.push("...");

                                            range.unshift(1);
                                            if (lastPage > 1) range.push(lastPage);

                                            return range.map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    disabled={p === "..."}
                                                    onClick={() => typeof p === 'number' && fetchKunjungan(p)}
                                                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${p === currentPage
                                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                                                        : p === "..."
                                                            ? "bg-transparent text-slate-300 cursor-default"
                                                            : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:scale-105"
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ));
                                        })()}
                                    </div>

                                    {/* MOBILE PAGE INDICATOR */}
                                    <div className="md:hidden flex items-center justify-center h-9 px-3 bg-slate-50 rounded-lg text-xs font-extra-bold text-slate-700 tracking-wide">
                                        <span className="text-blue-600 mr-1">{pagination.current_page}</span> / <span className="text-slate-400 ml-1">{pagination.last_page}</span>
                                    </div>

                                    {/* DIVIDER Mobile */}
                                    <div className="md:hidden w-px h-5 bg-slate-200 mx-1"></div>

                                    {/* NEXT */}
                                    <button
                                        disabled={pagination.current_page === pagination.last_page}
                                        onClick={() => fetchKunjungan(pagination.current_page + 1)}
                                        className="h-9 px-3 bg-transparent text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl text-xs font-bold disabled:opacity-30 disabled:hover:bg-transparent transition-all active:scale-95 flex items-center gap-1"
                                    >
                                        <span className="hidden sm:inline">Next</span>
                                        <Icon icon="mdi:chevron-right" width="18" />
                                    </button>
                                </div>
                            </div>
                        )
                    }

                </div >
            )
            }

        </div >
    );
}
