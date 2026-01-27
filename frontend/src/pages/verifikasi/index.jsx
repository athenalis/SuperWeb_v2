import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import { toast } from "react-hot-toast";

export default function Verifikasi() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const role = localStorage.getItem("role");

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "pending");
    const [relawanFilter, setRelawanFilter] = useState(searchParams.get("relawan_id") || "");
    const [pendingCount, setPendingCount] = useState(0);

    // Modal states
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedKunjungan, setSelectedKunjungan] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Expandable cards
    const [expandedCards, setExpandedCards] = useState([]);

    // Permission check
    useEffect(() => {
        if (role && role !== "koordinator" && role !== "admin") {
            toast.error("Akses ditolak. Halaman ini khusus untuk koordinator.");
            setTimeout(() => navigate("/"), 1000);
        }
    }, [role, navigate]);

    // Fetch data
    useEffect(() => {
        if (role === "koordinator" || role === "admin") {
            fetchData();
        }
    }, [statusFilter, relawanFilter, role]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const params = { per_page: 50 };
            if (statusFilter && statusFilter !== "all") params.status_verifikasi = statusFilter;
            if (relawanFilter) params.relawan_id = relawanFilter;
            if (search) params.search = search;

            const res = await api.get("/kunjungan", { params });
            if (res.data.success) {
                setData(res.data.data.data || []);

                // Get pending count
                const pendingRes = await api.get("/kunjungan", {
                    params: { status_verifikasi: "pending", per_page: 1 }
                });
                setPendingCount(pendingRes.data.data.total || 0);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data kunjungan");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchData();
    };

    const handleApprove = async (kunjunganId) => {
        if (!confirm("Apakah Anda yakin ingin menyetujui kunjungan ini?")) return;

        try {
            setActionLoading(true);
            await api.post(`/kunjungan/${kunjunganId}/verifikasi`, {
                status_verifikasi: "accepted",
            });
            toast.success("Kunjungan berhasil disetujui");
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Gagal menyetujui kunjungan");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectClick = (kunjungan) => {
        setSelectedKunjungan(kunjungan);
        setRejectReason("");
        setShowRejectModal(true);
    };

    const handleRejectSubmit = async () => {
        if (!rejectReason.trim()) {
            toast.error("Alasan penolakan wajib diisi");
            return;
        }

        try {
            setActionLoading(true);
            await api.post(`/kunjungan/${selectedKunjungan.id}/verifikasi`, {
                status_verifikasi: "rejected",
                komentar_verifikasi: rejectReason,
            });
            toast.success("Kunjungan ditolak");
            setShowRejectModal(false);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Gagal menolak kunjungan");
        } finally {
            setActionLoading(false);
        }
    };

    const toggleExpand = (id) => {
        setExpandedCards(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: "bg-amber-100 text-amber-700 border-amber-300",
            accepted: "bg-green-100 text-green-700 border-green-300",
            rejected: "bg-red-100 text-red-700 border-red-300",
        };
        return colors[status] || "bg-slate-100 text-slate-700 border-slate-300";
    };

    const getPhotoUrl = (fotoKtp) => {
        if (!fotoKtp) return null;
        return import.meta.env.VITE_STORAGE_URL
            ? `${import.meta.env.VITE_STORAGE_URL}/${fotoKtp}`
            : `${api.defaults.baseURL.replace("/api", "")}/storage/${fotoKtp}`;
    };

    if (loading && data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full mb-4" />
                <p className="text-slate-600 font-medium">Memuat data...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg">
                        <Icon icon="mdi:clipboard-check" width="24" className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Verifikasi Kunjungan</h1>
                        <p className="text-sm text-slate-500">Kelola dan verifikasi kunjungan lapangan</p>
                    </div>
                </div>
                {pendingCount > 0 && (
                    <div className="mt-4 bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-center gap-3">
                        <Icon icon="mdi:alert-circle" className="text-amber-600" width="24" />
                        <span className="text-sm font-semibold text-amber-800">
                            {pendingCount} kunjungan menunggu verifikasi
                        </span>
                    </div>
                )}
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border-2 border-slate-100 mb-6 space-y-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                    {[
                        { id: "all", label: "Semua", icon: "mdi:layers-outline" },
                        { id: "pending", label: "Pending", icon: "mdi:clock-outline" },
                        { id: "accepted", label: "Setuju", icon: "mdi:check-circle-outline" },
                        { id: "rejected", label: "Tolak", icon: "mdi:close-circle-outline" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${statusFilter === tab.id
                                ? "bg-white text-blue-900 shadow-md"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            <Icon icon={tab.icon} width="18" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSearch} className="relative">
                    <input
                        type="text"
                        placeholder="Cari Nama atau NIK..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                    <Icon
                        icon="mdi:magnify"
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        width="20"
                    />
                </form>
            </div>

            {/* Grid */}
            {data.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border-2 border-dashed border-slate-200">
                    <Icon icon="mdi:clipboard-text-outline" width={64} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Tidak ada data</h3>
                    <p className="text-sm text-slate-500">Tidak ada kunjungan dengan kriteria yang dipilih.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {data.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 ${getStatusColor(item.status_verifikasi)}`}>
                                    {item.status_verifikasi === "pending"
                                        ? "PENDING"
                                        : item.status_verifikasi === "accepted"
                                            ? "DISETUJUI"
                                            : "DITOLAK"}
                                </span>
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <Icon icon="mdi:calendar-outline" width="14" />
                                    <span className="text-xs font-semibold">
                                        {new Date(item.created_at).toLocaleDateString("id-ID", {
                                            day: "2-digit",
                                            month: "short",
                                        })}
                                    </span>
                                </div>
                            </div>

                            {/* KTP Photo */}
                            {item.foto_ktp ? (
                                <div className="mb-4 rounded-xl overflow-hidden border-2 border-slate-200">
                                    <img
                                        src={getPhotoUrl(item.foto_ktp)}
                                        alt="KTP"
                                        className="w-full h-40 object-cover bg-slate-100"
                                        onError={(e) => {
                                            e.target.src = "https://placehold.co/400x250?text=Foto+KTP";
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="mb-4 h-40 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300">
                                    <span className="text-sm text-slate-400 italic">Foto KTP tidak ada</span>
                                </div>
                            )}

                            {/* Info */}
                            <div className="space-y-3 mb-4">
                                <h4 className="font-bold text-lg text-slate-900 line-clamp-1">{item.nama}</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center">
                                            <Icon icon="mdi:card-account-details" width="14" className="text-blue-600" />
                                        </div>
                                        <span className="font-mono">{item.nik}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-slate-600">
                                        <div className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                                            <Icon icon="mdi:map-marker" width="14" className="text-green-600" />
                                        </div>
                                        <span className="line-clamp-2 leading-relaxed text-xs">{item.alamat}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Family Members Toggle */}
                            {item.family_form?.members?.length > 0 && (
                                <div className="mb-4 pb-4 border-b">
                                    <button
                                        onClick={() => toggleExpand(item.id)}
                                        className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors w-full"
                                    >
                                        <Icon
                                            icon="mdi:chevron-down"
                                            width="20"
                                            className={`transition-transform ${expandedCards.includes(item.id) ? "rotate-180" : ""}`}
                                        />
                                        <span>
                                            {expandedCards.includes(item.id) ? "Sembunyikan" : "Lihat"} Anggota ({item.family_form.members.length})
                                        </span>
                                    </button>

                                    {expandedCards.includes(item.id) && (
                                        <div className="mt-3 space-y-2 pl-7">
                                            {item.family_form.members.map((member) => (
                                                <div key={member.id} className="bg-slate-50 rounded-lg p-2.5 text-xs border border-slate-100">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-semibold text-slate-800">{member.nama}</span>
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold capitalize text-[10px]">
                                                            {member.hubungan}
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-500 font-mono">{member.nik}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2">
                                {item.status_verifikasi === "pending" && (
                                    <>
                                        <button
                                            onClick={() => handleApprove(item.id)}
                                            disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-all disabled:opacity-50"
                                        >
                                            <Icon icon="mdi:check-circle" width="18" />
                                            Setuju
                                        </button>
                                        <button
                                            onClick={() => handleRejectClick(item)}
                                            disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
                                        >
                                            <Icon icon="mdi:close-circle" width="18" />
                                            Tolak
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => navigate(`/kunjungan/${item.id}`)}
                                    className={`${item.status_verifikasi === "pending" ? "w-auto" : "flex-1"} flex items-center justify-center gap-1.5 py-2.5 bg-blue-100 text-blue-900 rounded-lg font-bold text-sm hover:bg-blue-200 transition-all`}
                                >
                                    <Icon icon="mdi:eye" width="18" />
                                    Detail
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">Alasan Penolakan</h3>
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="p-1 hover:bg-slate-100 rounded-full transition"
                            >
                                <Icon icon="mdi:close" width="20" />
                            </button>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Jelaskan alasan penolakan <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Contoh: Foto KTP tidak jelas, data tidak lengkap, dll."
                                rows={4}
                                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleRejectSubmit}
                                disabled={actionLoading || !rejectReason.trim()}
                                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {actionLoading && <Icon icon="mdi:loading" className="animate-spin" width="18" />}
                                Tolak Kunjungan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
