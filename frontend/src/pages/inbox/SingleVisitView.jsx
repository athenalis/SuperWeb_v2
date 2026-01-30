import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import { toast } from "react-hot-toast";

export default function SingleVisitView({ notification, onComplete }) {
    const [visit, setVisit] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectComment, setRejectComment] = useState("");
    const [zoomImage, setZoomImage] = useState(null);

    const kunjunganId = notification?.data?.kunjungan_id;
    const role = localStorage.getItem("role");

    useEffect(() => {
        if (kunjunganId) {
            fetchVisitDetail();
        }
    }, [kunjunganId]);

    const fetchVisitDetail = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/kunjungan/${kunjunganId}`);
            if (res.data.success) {
                setVisit(res.data.data);
            }
        } catch (err) {
            if (err.response && err.response.status === 404) {
                toast.error("Data kunjungan ini sudah dihapus");
                setVisit(null);
            } else {
                console.error("Failed to fetch visit detail", err);
                toast.error("Gagal memuat detail kunjungan");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        try {
            const res = await api.post(`/kunjungan/${visit.id}/verifikasi`, {
                status: 'accepted'
            });
            if (res.data.success) {
                toast.success("Kunjungan disetujui");
                // Refresh data to update status and hide buttons
                await fetchVisitDetail();
            }
        } catch (err) {
            toast.error("Gagal menyetujui kunjungan");
        }
    };

    const handleReject = async () => {
        if (!rejectComment.trim()) {
            toast.error("Catatan revisi wajib diisi");
            return;
        }

        try {
            const res = await api.post(`/kunjungan/${visit.id}/verifikasi`, {
                status: 'rejected',
                keterangan: rejectComment,
                komentar: rejectComment
            });
            if (res.data.success) {
                toast.success("Kunjungan ditandai untuk revisi");
                setShowRejectForm(false);
                setRejectComment("");
                // Refresh data to update status and hide buttons
                await fetchVisitDetail();
            }
        } catch (err) {
            toast.error("Gagal menandai kunjungan");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Icon icon="svg-spinners:180-ring-with-bg" width="40" className="mb-3" />
                <p>Memuat detail kunjungan...</p>
            </div>
        );
    }

    if (!visit) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Icon icon="mdi:alert-circle-outline" width="48" className="mb-2 opacity-30" />
                <p>Data kunjungan tidak ditemukan</p>
            </div>
        );
    }

    // Helper to determine if reminder should be shown
    const showReminder = () => {
        if (!visit) return null;

        if (role === "koordinator" && visit.status_verifikasi === "pending") {
            return {
                icon: "⚠️",
                title: "Jangan Lupa Verifikasi!",
                message: "Kunjungan ini masih menunggu verifikasi Anda.",
                bgColor: "bg-amber-50",
                borderColor: "border-amber-300",
                textColor: "text-amber-800"
            };
        }

        if (role === "relawan") {
            if (visit.status === "draft") {
                return {
                    icon: "📝",
                    title: "Masih Draft!",
                    message: "Jangan lupa submit laporan kunjungan ini.",
                    bgColor: "bg-blue-50",
                    borderColor: "border-blue-300",
                    textColor: "text-blue-800"
                };
            }
            if (visit.status_verifikasi === "rejected" || visit.status_verifikasi === "needs_revision") {
                return {
                    icon: "❌",
                    title: "Perlu Perbaikan!",
                    message: "Kunjungan ini ditolak. Silakan perbaiki dan submit kembali.",
                    bgColor: "bg-red-50",
                    borderColor: "border-red-300",
                    textColor: "text-red-800"
                };
            }
        }
        return null;
    };

    const reminder = showReminder();

    return (
        <div className="h-full flex flex-col bg-white rounded-r-2xl overflow-hidden relative">
            {/* STICKY REMINDER BANNER */}
            {reminder && (
                <div className={`${reminder.bgColor} ${reminder.textColor} border-b ${reminder.borderColor} px-6 py-4 flex items-start gap-4 animate-in slide-in-from-top duration-300 shadow-sm z-30`}>
                    <span className="text-2xl mt-0.5">{reminder.icon}</span>
                    <div>
                        <h3 className="font-bold text-sm mb-0.5">{reminder.title}</h3>
                        <p className="text-xs opacity-90 leading-relaxed">{reminder.message}</p>
                    </div>
                </div>
            )}

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
                        <h2 className="text-xl font-bold text-slate-800">Detail Kunjungan</h2>
                        <p className="text-sm text-slate-500">
                            Relawan: <span className="font-semibold text-blue-900">{visit.relawan?.nama || '-'}</span>
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchVisitDetail}
                    className="p-2 text-slate-400 hover:text-blue-600 transition"
                    title="Refresh Data"
                >
                    <Icon icon="mdi:refresh" width="20" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
                    {/* Foto Display - ENLARGED SPLIT VIEW */}
                    <div className="flex flex-col xl:flex-row gap-6 mb-8">
                        {/* KTP Section */}
                        <div className="w-full xl:w-1/2">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Icon icon="mdi:card-account-details" /> Foto KTP
                            </h3>
                            <div
                                className="w-full h-64 md:h-96 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in relative group transition-all hover:shadow-lg"
                                onClick={() => setZoomImage(`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${visit.foto_ktp}`)}
                            >
                                {visit.foto_ktp ? (
                                    <>
                                        <img
                                            src={`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${visit.foto_ktp}`}
                                            alt="KTP"
                                            className="w-full h-full object-contain bg-slate-900/5 group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                                            <div className="bg-black/50 text-white px-4 py-2 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 duration-300">
                                                <Icon icon="mdi:magnify-plus" /> Klik untuk Memperbesar
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 flex-col gap-2">
                                        <Icon icon="mdi:image-off" width="48" />
                                        <span className="text-sm">Tidak ada foto</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info Utama Section */}
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Icon icon="mdi:clipboard-text" /> Data Form
                            </h3>
                            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 h-full">
                                <h3 className="text-2xl font-bold text-slate-800 mb-4 pb-4 border-b border-slate-200 leading-tight">{visit.nama}</h3>
                                <div className="grid grid-cols-1 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500 block mb-1">NIK:</span>
                                        <p className="font-bold text-slate-800 break-all text-base bg-white px-3 py-2 rounded border border-slate-200">{visit.nik}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-slate-500 block mb-1">Umur:</span>
                                            <p className="font-semibold text-slate-800 bg-white px-3 py-2 rounded border border-slate-200">{visit.umur} thn</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block mb-1">Pendidikan:</span>
                                            <p className="font-semibold text-slate-800 bg-white px-3 py-2 rounded border border-slate-200">{visit.pendidikan}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block mb-1">Pekerjaan:</span>
                                        <p className="font-semibold text-slate-800 bg-white px-3 py-2 rounded border border-slate-200">{visit.pekerjaan}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block mb-1">Penghasilan:</span>
                                        <p className="font-semibold text-slate-800 bg-white px-3 py-2 rounded border border-slate-200">{visit.penghasilan}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 flex items-center gap-1 mb-1">
                                            <Icon icon="mdi:map-marker-outline" width="14" /> Alamat:
                                        </span>
                                        <p className="font-semibold text-slate-800 bg-white px-3 py-2 rounded border border-slate-200 min-h-[3rem]">{visit.alamat}</p>
                                        {(visit.latitude && visit.longitude) && (
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-blue-600 font-bold mt-2 hover:underline"
                                            >
                                                <Icon icon="mdi:map-search-outline" /> Lihat Lokasi di Peta
                                            </a>
                                        )}
                                    </div>
                                    {/* Revision History */}
                                    {visit.komentar_verifikasi && (
                                        <div className="md:col-span-2 bg-orange-50 border border-orange-100 text-orange-800 text-sm p-3 rounded-lg flex gap-2 items-start mt-2">
                                            <Icon icon="mdi:history" className="mt-0.5 flex-shrink-0 text-lg" />
                                            <div>
                                                <span className="font-bold block">Catatan Revisi Sebelumnya:</span>
                                                <p className="opacity-90">"{visit.komentar_verifikasi}"</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Anggota Keluarga */}
                    {visit.family_form?.members && visit.family_form.members.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Icon icon="mdi:account-group" width="18" />
                                Anggota Keluarga ({visit.family_form.members.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {visit.family_form.members.map((member, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex gap-3">
                                        {/* Thumbnail */}
                                        <div
                                            className="w-24 h-24 bg-white rounded border border-slate-200 overflow-hidden cursor-zoom-in flex-shrink-0 relative group"
                                            onClick={() => setZoomImage(`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${member.foto_ktp}`)}
                                        >
                                            {member.foto_ktp ? (
                                                <img
                                                    src={`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${member.foto_ktp}`}
                                                    alt={member.nama}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <Icon icon="mdi:image-off" width="16" />
                                                </div>
                                            )}
                                        </div>
                                        {/* Details */}
                                        <div className="flex-1 min-w-0 text-sm">
                                            <div className="font-bold text-slate-800 text-base mb-1 truncate">{member.nama}</div>
                                            <div className="text-slate-600 grid grid-cols-1 gap-0.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span>NIK:</span> <span className="font-mono">{member.nik}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Hubungan:</span> <span className="font-semibold">{member.hubungan}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Umur:</span> <span>{member.umur} th</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons or Status */}
                    {visit.status_verifikasi && visit.status_verifikasi !== 'pending' ? (
                        /* Already verified - show status */
                        <div className="mt-6 p-4 rounded-lg text-center">
                            {visit.status_verifikasi === 'accepted' ? (
                                <div className="bg-green-50 border border-green-200 text-green-800 py-3 rounded-lg flex items-center justify-center gap-2">
                                    <Icon icon="mdi:check-circle" width={20} />
                                    <span className="font-semibold">Sudah Disetujui</span>
                                </div>
                            ) : (visit.status_verifikasi === 'rejected' || visit.status_verifikasi === 'needs_revision') ? (
                                <div className="bg-red-50 border border-red-200 text-red-800 py-3 rounded-lg">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <Icon icon="mdi:close-circle" width={20} />
                                        <span className="font-semibold">Sudah Ditandai untuk Revisi</span>
                                    </div>
                                    {visit.komentar_verifikasi && (
                                        <p className="text-sm mt-2 text-red-700 bg-white/50 p-2 rounded">
                                            "{visit.komentar_verifikasi}"
                                        </p>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        /* Not verified yet - show action buttons */
                        <>
                            <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
                                <button
                                    onClick={handleApprove}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white py-3.5 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-green-500/30 transition flex items-center justify-center gap-2"
                                >
                                    <Icon icon="mdi:check-decagram" width={20} /> Terima Kunjungan
                                </button>
                                <button
                                    onClick={() => setShowRejectForm(true)}
                                    className="flex-1 bg-white border-2 border-red-100 text-red-600 py-3.5 rounded-xl text-sm font-bold hover:bg-red-50 hover:border-red-200 transition flex items-center justify-center gap-2"
                                >
                                    <Icon icon="mdi:alert-circle-outline" width={20} /> Minta Revisi
                                </button>
                            </div>

                            {/* Comment Form */}
                            {showRejectForm && (
                                <div className="mt-6 p-6 bg-orange-50 rounded-xl border border-orange-100 animate-fade-in">
                                    <label className="block text-sm font-bold text-orange-900 mb-3 flex items-center gap-2">
                                        <Icon icon="mdi:message-alert" /> Catatan Revisi (Wajib Diisi):
                                    </label>
                                    <textarea
                                        className="w-full border border-orange-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white shadow-sm"
                                        placeholder="Contoh: Foto KTP buram, NIK tidak sesuai..."
                                        value={rejectComment}
                                        onChange={(e) => setRejectComment(e.target.value)}
                                        rows={4}
                                        autoFocus
                                    />
                                    <div className="flex gap-3 mt-4">
                                        <button
                                            onClick={handleReject}
                                            className="flex-1 bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-orange-700 transition shadow-lg shadow-orange-500/20"
                                        >
                                            Kirim Revisi
                                        </button>
                                        <button
                                            onClick={() => { setShowRejectForm(false); setRejectComment(""); }}
                                            className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                                        >
                                            Batal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ZOOM MODAL */}
            {zoomImage && (
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
            )}
        </div>
    );
}
