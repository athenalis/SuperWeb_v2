import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import { toast } from "react-hot-toast";

export default function BatchVerificationView({ notification, onComplete }) {
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [rejectId, setRejectId] = useState(null);
    const [rejectComment, setRejectComment] = useState("");

    const data = notification?.data || {};
    const relawanId = data.relawan_id;
    const relawanNama = data.relawan_nama;
    const [zoomImage, setZoomImage] = useState(null);

    useEffect(() => {
        if (relawanId) {
            fetchBatchData();
        }
    }, [relawanId]);


    const fetchBatchData = async () => {
        setLoading(true);
        try {
            // Fetch pending visits for this relawan, limit 5
            const res = await api.get(`/kunjungan?relawan_id=${relawanId}&status=pending&per_page=5`);
            if (res.data.success) {
                setVisits(res.data.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch batch data", err);
            toast.error("Gagal memuat data kunjungan");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await api.post(`/kunjungan/${id}/verifikasi`, {
                status: 'accepted'
            });
            if (res.data.success) {
                toast.success("Kunjungan disetujui");
                // Remove from list
                setVisits(prev => prev.filter(v => v.id !== id));
                checkCompletion(visits.length - 1);
            }
        } catch (err) {
            toast.error("Gagal menyetujui kunjungan");
        }
    };

    const handleRejectClick = (id) => {
        setRejectId(id);
    };

    const handleReject = async () => {
        if (!rejectComment.trim()) {
            toast.error("Catatan revisi wajib diisi");
            return;
        }

        try {
            const res = await api.post(`/kunjungan/${rejectId}/verifikasi`, {
                status: 'rejected',
                keterangan: rejectComment
            });
            if (res.data.success) {
                toast.success("Kunjungan ditandai untuk revisi");
                setVisits(prev => prev.filter(v => v.id !== rejectId));
                setRejectId(null);
                setRejectComment("");
                checkCompletion(visits.length - 1);
            }
        } catch (err) {
            toast.error("Gagal menandai kunjungan");
        }
    };

    const checkCompletion = (remainingCount) => {
        if (remainingCount <= 0) {
            // Batch complete
            toast.success(`Batch verifikasi untuk ${relawanNama} selesai!`);
            if (onComplete) onComplete();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Icon icon="svg-spinners:180-ring-with-bg" width="40" className="mb-3" />
                <p>Memuat data verifikasi...</p>
            </div>
        );
    }

    if (visits.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <Icon icon="mdi:check-all" width="32" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Batch Selesai!</h3>
                <p className="max-w-xs mt-2">Semua kunjungan dalam batch ini sudah diproses. Pilih notifikasi lain untuk verifikasi.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white rounded-r-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onComplete}
                        className="md:hidden p-1 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/50 transition mr-1"
                    >
                        <Icon icon="mdi:arrow-left" width={24} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Verifikasi Kunjungan</h2>
                        <p className="text-sm text-slate-500">Relawan: <span className="font-semibold text-blue-900">{relawanNama}</span> ({visits.length} items)</p>
                    </div>
                </div>
                <button
                    onClick={fetchBatchData}
                    className="p-2 text-slate-400 hover:text-blue-600 transition"
                    title="Refresh Data"
                >
                    <Icon icon="mdi:refresh" width="20" />
                </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {visits.map(item => (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:border-blue-300 transition-all shadow-sm bg-white">
                        <div className="flex gap-4">
                            {/* Foto Display - Placeholder or real if available */}
                            <div
                                className="w-32 h-32 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden border border-slate-200 cursor-zoom-in relative group"
                                onClick={() => item.foto_ktp && setZoomImage(`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${item.foto_ktp}`)}
                            >
                                {item.foto_ktp ? (
                                    <>
                                        <img src={`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${item.foto_ktp}`} alt="Kunjungan" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                                            <Icon icon="mdi:magnify-plus" className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" width="24" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <Icon icon="mdi:image-off" width="24" />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg text-slate-800">{item.nama}</h4>
                                <div className="text-sm text-slate-500 mb-2 flex flex-col gap-1">
                                    <span className="flex items-center gap-1">
                                        <Icon icon="mdi:card-account-details-outline" width="14" /> NIK: {item.nik}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Icon icon="mdi:map-marker-outline" width="14" /> {item.alamat}
                                    </span>
                                    {(item.latitude && item.longitude) && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition w-fit mt-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Icon icon="mdi:map-search-outline" /> Lihat Lokasi
                                        </a>
                                    )}
                                </div>

                                {/* Revision History */}
                                {item.komentar_verifikasi && (
                                    <div className="bg-orange-50 border border-orange-100 text-orange-800 text-xs p-2 rounded mb-2 flex gap-2 items-start">
                                        <Icon icon="mdi:history" className="mt-0.5 flex-shrink-0" />
                                        <div>
                                            <span className="font-bold">Revisi Sebelumnya:</span>
                                            <p className="opacity-90">"{item.komentar_verifikasi}"</p>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons or Status */}
                                <div className="mt-auto pt-4">
                                    {item.status_verifikasi && item.status_verifikasi !== 'pending' ? (
                                        /* Already verified */
                                        item.status_verifikasi === 'accepted' ? (
                                            <div className="bg-green-50 border border-green-200 text-green-700 py-2 rounded-lg text-center text-sm font-semibold">
                                                ✓ Sudah Disetujui
                                            </div>
                                        ) : (
                                            <div className="bg-red-50 border border-red-200 text-red-700 py-2 rounded-lg text-center text-sm font-semibold">
                                                ✗ Sudah Ditandai
                                            </div>
                                        )
                                    ) : (
                                        /* Not verified - show buttons */
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprove(item.id)}
                                                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <Icon icon="mdi:check" width={18} /> Terima
                                            </button>
                                            <button
                                                onClick={() => handleRejectClick(item.id)}
                                                className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2"
                                            >
                                                <Icon icon="mdi:close" width={18} /> Tandai
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Anggota Keluarga Section - Added KTP Photos */}
                        {
                            item.family_form?.members && item.family_form.members.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <h5 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-2">
                                        <Icon icon="mdi:account-group" /> Anggota Keluarga ({item.family_form.members.length})
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {item.family_form.members.map((m, idx) => (
                                            <div key={idx} className="flex gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                {/* Member KTP Thumbnail */}
                                                <div
                                                    className="w-24 h-24 bg-white rounded border border-slate-200 overflow-hidden cursor-zoom-in flex-shrink-0 relative group"
                                                    onClick={() => m.foto_ktp && setZoomImage(`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${m.foto_ktp}`)}
                                                >
                                                    {m.foto_ktp ? (
                                                        <img
                                                            src={`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${m.foto_ktp}`}
                                                            alt={m.nama}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                            <Icon icon="mdi:image-off" width="16" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm truncate" title={m.nama}>{m.nama}</p>
                                                    <p className="text-xs text-slate-500">{m.hubungan} • {m.umur} th</p>
                                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.nik}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        }

                        {/* Comment Form */}
                        {rejectId === item.id && (
                            <div className="mt-4 pt-4 border-t border-orange-50">
                                <label className="block text-xs font-bold text-orange-800 mb-2">
                                    Catatan Revisi (Wajib):
                                </label>
                                <textarea
                                    className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    placeholder="Jelaskan apa yang perlu diperbaiki..."
                                    value={rejectComment}
                                    onChange={(e) => setRejectComment(e.target.value)}
                                    rows={3}
                                    autoFocus
                                />
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={handleReject}
                                        className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition"
                                    >
                                        Tandai untuk Revisi
                                    </button>
                                    <button
                                        onClick={() => { setRejectId(null); setRejectComment(""); }}
                                        className="text-slate-400 hover:text-slate-600 px-3"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ZOOM MODAL */}
            {
                zoomImage && (
                    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
                        <button className="absolute top-6 right-6 text-white p-3 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur-sm">
                            <Icon icon="mdi:close" width="32" />
                        </button>
                        <img
                            src={zoomImage}
                            alt="Zoom"
                            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
                        />
                        <div className="absolute bottom-6 text-white/50 text-sm font-medium">
                            Klik dimana saja untuk menutup
                        </div>
                    </div>
                )
            }
        </div >
    );
}
