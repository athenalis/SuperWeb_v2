import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import api from "../../lib/axios";

/**
 * Manajemen Kurir APK (Alat Peraga Kampanye)
 * - Hanya untuk role admin_apk
 * - CRUD Kurir APK
 * - Tanpa fitur pengiriman
 */

export default function KurirApkIndex() {
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("Semua");
    const [showModal, setShowModal] = useState(false);
    const [editingKurir, setEditingKurir] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        nama: "",
        no_hp: "",
    });

    // Fetch kurir list
    const { data: kurirData, isLoading, isError } = useQuery({
        queryKey: ["kurir-apk", searchTerm, filterStatus],
        queryFn: async () => {
            const params = {};
            if (searchTerm) params.search = searchTerm;
            if (filterStatus !== "Semua") params.status = filterStatus.toLowerCase();
            const res = await api.get("/apk-kurir", { params });
            return res.data;
        },
    });

    const kurirList = kurirData?.data || [];

    // Stats
    const totalKurir = kurirList.length;
    const kurirAktif = kurirList.filter((k) => k.status === "active").length;
    const totalPengiriman = kurirList.reduce((sum, k) => sum + (k.total_pengiriman || 0), 0);
    const pengirimanSelesai = kurirList.reduce((sum, k) => sum + (k.pengiriman_selesai || 0), 0);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: (data) => api.post("/apk-kurir", data),
        onSuccess: (res) => {
            queryClient.invalidateQueries(["apk-kurir"]);
            toast.success("Kurir berhasil ditambahkan!");

            // Show credentials if available
            if (res.data?.data?.user) {
                const { email, password } = res.data.data.user;
                toast.success(
                    <div className="text-sm">
                        <p className="font-bold mb-1">Kredensial Login:</p>
                        <p>Email: {email}</p>
                        <p>Password: {password}</p>
                    </div>,
                    { duration: 10000 }
                );
            }

            resetForm();
        },
        onError: (err) => {
            const msg = err.response?.data?.message || err.response?.data?.errors?.nama?.[0] || "Gagal menambahkan kurir";
            toast.error(msg);
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => api.put(`/apk-kurir/${id}`, data),
        onSuccess: (res) => {
            queryClient.invalidateQueries(["kurir-apk"]);
            toast.success("Kurir berhasil diperbarui!");

            // Show new credentials if name changed
            if (res.data?.data?.user) {
                const { email, password } = res.data.data.user;
                toast.success(
                    <div className="text-sm">
                        <p className="font-bold mb-1">Kredensial Baru:</p>
                        <p>Email: {email}</p>
                        <p>Password: {password}</p>
                    </div>,
                    { duration: 10000 }
                );
            }

            resetForm();
        },
        onError: (err) => {
            const msg = err.response?.data?.message || "Gagal memperbarui kurir";
            toast.error(msg);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/apk-kurir/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(["kurir-apk"]);
            toast.success("Kurir berhasil dihapus!");
            setDeleteConfirm(null);
        },
        onError: (err) => {
            const msg = err.response?.data?.message || "Gagal menghapus kurir";
            toast.error(msg);
        },
    });

    const resetForm = () => {
        setFormData({ nama: "", no_hp: "" });
        setEditingKurir(null);
        setShowModal(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.nama.trim()) {
            return toast.error("Nama kurir wajib diisi");
        }
        if (!formData.no_hp.trim()) {
            return toast.error("No. HP wajib diisi");
        }

        if (editingKurir) {
            updateMutation.mutate({
                id: editingKurir.id,
                data: formData,
            });
        } else {
            createMutation.mutate(formData);
        }
    };

    const openEditModal = (kurir) => {
        setEditingKurir(kurir);
        setFormData({
            nama: kurir.nama || "",
            no_hp: kurir.no_hp || "",
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const getStatusBadge = (status) => {
        const styles = {
            active: "bg-emerald-100 text-emerald-700 border-emerald-200",
            inactive: "bg-slate-100 text-slate-600 border-slate-200",
        };
        return styles[status] || "bg-slate-100 text-slate-600 border-slate-200";
    };

    const getStatusLabel = (status) => {
        const labels = {
            active: "Aktif",
            inactive: "Nonaktif",
        };
        return labels[status] || status;
    };

    const getInitials = (name) => {
        if (!name) return "?";
        const words = name.trim().split(" ");
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const getAvatarColor = (name) => {
        const colors = [
            "bg-blue-500", "bg-emerald-500", "bg-amber-500",
            "bg-purple-500", "bg-pink-500", "bg-cyan-500"
        ];
        const idx = (name || "").charCodeAt(0) % colors.length;
        return colors[idx];
    };

    return (
        <>
            <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl p-8 space-y-6">
                {/* HEADER */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-3">
                        Manajemen Kurir APK
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Kelola kurir alat peraga kampanye
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

                {/* FILTER & ACTIONS */}
                <div className="bg-white rounded-xl border border-slate-200 mb-6">
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
                                    placeholder="Cari kurir..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full sm:w-64 pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                />
                            </div>

                            {/* Status Filter */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition cursor-pointer hover:bg-slate-50"
                            >
                                <option value="Semua">Semua Status</option>
                                <option value="active">Aktif</option>
                                <option value="inactive">Nonaktif</option>
                            </select>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                            <Icon icon="mdi:account-plus" width={20} />
                            Tambah Kurir
                        </button>
                    </div>
                </div>

                {/* KURIR TABLE */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Icon icon="mdi:loading" className="animate-spin text-blue-600" width={40} />
                        </div>
                    ) : isError ? (
                        <div className="text-center py-20 text-red-500">
                            <Icon icon="mdi:alert-circle" width={48} className="mx-auto mb-2" />
                            <p>Gagal memuat data kurir</p>
                        </div>
                    ) : kurirList.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">
                            <Icon icon="mdi:account-off" width={48} className="mx-auto mb-2 text-slate-300" />
                            <p>Belum ada kurir terdaftar</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Kurir
                                        </th>
                                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            No. HP
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Total Pengiriman
                                        </th>
                                        <th className="text-center px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            Selesai
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
                                    {kurirList.map((kurir) => (
                                        <tr key={kurir.id} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${getAvatarColor(kurir.nama)}`}>
                                                        {getInitials(kurir.nama)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{kurir.nama}</p>
                                                        {kurir.user?.email && (
                                                            <p className="text-xs text-slate-500">{kurir.user.email}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600">{kurir.no_hp}</td>
                                            <td className="px-5 py-4 text-center font-bold text-slate-800">
                                                {kurir.total_pengiriman || 0}
                                            </td>
                                            <td className="px-5 py-4 text-center font-bold text-emerald-600">
                                                {kurir.pengiriman_selesai || 0}
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
                                                        onClick={() => openEditModal(kurir)}
                                                        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded transition"
                                                        title="Edit"
                                                    >
                                                        <Icon icon="proicons:pencil" width={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(kurir)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                        title="Hapus"
                                                    >
                                                        <Icon icon="mynaui:trash" width={20} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* CREATE/EDIT MODAL */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Icon
                                        icon={editingKurir ? "mdi:account-edit" : "mdi:account-plus"}
                                        className="text-blue-600"
                                        width={24}
                                    />
                                    {editingKurir ? "Edit Kurir" : "Tambah Kurir Baru"}
                                </h3>
                                <button
                                    onClick={resetForm}
                                    className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-600"
                                >
                                    <Icon icon="mdi:close" width={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="p-6 space-y-4">
                                    {/* Nama Kurir */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            Nama Kurir <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Masukkan nama kurir"
                                            value={formData.nama}
                                            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Nama tidak boleh mengandung angka</p>
                                    </div>

                                    {/* Telepon */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                                            No. HP <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            placeholder="08xxxxxxxxxx"
                                            value={formData.no_hp}
                                            onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Format: 10-13 digit tanpa awalan 021</p>
                                    </div>
                                </div>

                                <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createMutation.isPending || updateMutation.isPending}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {(createMutation.isPending || updateMutation.isPending) && (
                                            <Icon icon="mdi:loading" className="animate-spin" width={18} />
                                        )}
                                        {editingKurir ? "Simpan Perubahan" : "Tambah Kurir"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* DELETE CONFIRMATION MODAL */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon icon="mdi:delete-alert" className="text-red-600" width={32} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Kurir?</h3>
                                <p className="text-slate-500 mb-6">
                                    Anda yakin ingin menghapus kurir <strong>{deleteConfirm.nama}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setDeleteConfirm(null)}
                                        className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                                        disabled={deleteMutation.isPending}
                                        className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {deleteMutation.isPending && (
                                            <Icon icon="mdi:loading" className="animate-spin" width={18} />
                                        )}
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
