import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import api from "../../lib/axios";
import { toast } from "react-hot-toast";

// Updated for remove useNavigate
export default function RelawanVisitView({ notification, onComplete }) {
    const [visit, setVisit] = useState(null);
    const [loading, setLoading] = useState(false);

    const kunjunganId = notification?.data?.kunjungan_id;

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
            console.error("Failed to fetch visit detail", err);
            if (err.response && err.response.status === 404) {
                toast.error("Data kunjungan ini sudah dihapus");
                setVisit(null); // Ensure null state
            } else {
                toast.error("Gagal memuat detail kunjungan");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        const editUrl = `/kunjungan/${visit.id}/edit`;
        console.log("Navigating to edit page (force):", editUrl);
        window.location.href = editUrl;
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

    return (
        <div className="h-full flex flex-col bg-white rounded-r-2xl overflow-hidden">
            {/* Header - Matched SingleVisitView Style */}
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
                            Tanggal: <span className="font-semibold text-slate-700">{new Date(visit.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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
                    {/* Foto Display */}
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                        <div className="w-full md:w-32 h-48 md:h-32 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden border border-slate-200">
                            {visit.foto_ktp ? (
                                <img
                                    src={`${(import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:9000/api`).replace('/api', '')}/storage/${visit.foto_ktp}`}
                                    alt="KTP"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Icon icon="mdi:image-off" width="32" />
                                </div>
                            )}
                        </div>

                        {/* Info Utama */}
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold text-slate-800 mb-3">{visit.nama}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-slate-500">NIK:</span>
                                    <p className="font-semibold text-slate-800 break-all">{visit.nik}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Umur:</span>
                                    <p className="font-semibold text-slate-800">{visit.umur} tahun</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Pendidikan:</span>
                                    <p className="font-semibold text-slate-800">{visit.pendidikan}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500">Pekerjaan:</span>
                                    <p className="font-semibold text-slate-800">{visit.pekerjaan}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <span className="text-slate-500">Penghasilan:</span>
                                    <p className="font-semibold text-slate-800">{visit.penghasilan}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <Icon icon="mdi:map-marker-outline" width="14" /> Alamat:
                                    </span>
                                    <p className="font-semibold text-slate-800">{visit.alamat}</p>
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
                            <div className="space-y-2">
                                {visit.family_form.members.map((member, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-lg p-3 text-sm">
                                        <div className="font-semibold text-slate-800">{member.nama}</div>
                                        <div className="text-slate-600">
                                            NIK: {member.nik} | {member.hubungan} | {member.umur} tahun
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Display - Matched SingleVisitView Layout */}
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
                                    <span className="font-semibold">Perlu Revisi</span>
                                </div>
                                {visit.komentar_verifikasi && (
                                    <p className="text-sm mt-2 text-red-700 px-4">
                                        Catatan: {visit.komentar_verifikasi}
                                    </p>
                                )}
                                {/* Edit Action for Rejected */}
                                <div className="mt-4 px-4 pb-2">
                                    <button
                                        onClick={handleEdit}
                                        className="w-full bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <Icon icon="mdi:pencil" width={18} /> Perbaiki Data
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-orange-50 border border-orange-200 text-orange-800 py-3 rounded-lg flex items-center justify-center gap-2">
                                <Icon icon="mdi:clock-outline" width={20} />
                                <span className="font-semibold">Menunggu Verifikasi Koordinator</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
