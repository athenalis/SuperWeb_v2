// src/pages/inbox/AdminApkRequestView.jsx
import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import api from "../../lib/axios";

function formatDateTime(iso) {
    try {
        return new Date(iso).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso || "-";
    }
}

function StatusChip({ statusCode }) {
    const base = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border";

    const statusMap = {
        SUBMITTED: { icon: "mdi:clock", label: "Menunggu", classes: "bg-amber-50 text-amber-700 border-amber-200" },
        REVISED: { icon: "mdi:pencil", label: "Direvisi", classes: "bg-orange-50 text-orange-700 border-orange-200" },
        APPROVED: { icon: "mdi:check-circle", label: "Disetujui", classes: "bg-green-50 text-green-700 border-green-200" },
        REJECTED: { icon: "mdi:close-circle", label: "Ditolak", classes: "bg-rose-50 text-rose-700 border-rose-200" },
        PICKED_UP: { icon: "mdi:truck", label: "Diambil", classes: "bg-indigo-50 text-indigo-700 border-indigo-200" },
        ARRIVED: { icon: "mdi:map-marker-check", label: "Sampai", classes: "bg-teal-50 text-teal-700 border-teal-200" },
        DELIVERED: { icon: "mdi:check-all", label: "Diterima", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    };

    const status = statusMap[statusCode] || { icon: "mdi:help", label: statusCode || "-", classes: "bg-gray-50 text-gray-700 border-gray-200" };

    return (
        <span className={`${base} ${status.classes}`}>
            <Icon icon={status.icon} width={14} /> {status.label}
        </span>
    );
}

function SectionCard({ title, icon, children, right }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    {icon && <Icon icon={icon} className="text-blue-900" width={20} />}
                    <div className="font-bold text-slate-800 text-lg">{title}</div>
                </div>
                {right}
            </div>
            <div className="mt-3 text-sm text-slate-700">{children}</div>
        </div>
    );
}

function ModalShell({ open, onClose, title, children, footer }) {
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div className="text-xl font-bold text-slate-900">{title}</div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
                        <Icon icon="mdi:close" width={20} />
                    </button>
                </div>
                <div className="p-5">{children}</div>
                {footer && <div className="p-5 border-t border-slate-100 bg-white">{footer}</div>}
            </div>
        </div>,
        document.getElementById("modal-root") || document.body
    );
}

export default function AdminApkRequestView({ requestId, onComplete, onBack }) {
    const queryClient = useQueryClient();

    // Fetch request detail
    const { data: requestData, isLoading, error } = useQuery({
        queryKey: ["apk-request-detail", requestId],
        queryFn: async () => {
            const res = await api.get(`/apk-requests/${requestId}`);
            return res.data?.data || res.data;
        },
        enabled: !!requestId,
    });

    // Fetch couriers for approval
    const { data: couriers = [] } = useQuery({
        queryKey: ["apk-couriers"],
        queryFn: async () => {
            const res = await api.get("/apk-kurir/active");
            return res.data?.data || res.data || [];
        },
    });

    const order = requestData;
    const status = order?.status?.code;
    const canAct = status === "SUBMITTED" || status === "REVISED";

    const [approveOpen, setApproveOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [selectedCourierId, setSelectedCourierId] = useState("");
    const [pickupAddress, setPickupAddress] = useState("");
    const [pickupDate, setPickupDate] = useState("");
    const [feedback, setFeedback] = useState("");

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: async () => {
            const res = await api.patch(`/apk-requests/${requestId}/approve`, {
                courier_id: parseInt(selectedCourierId),
                pickup_address: pickupAddress,
                pickup_scheduled_at: pickupDate,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Request berhasil disetujui!");
            queryClient.invalidateQueries(["apk-request-detail", requestId]);
            queryClient.invalidateQueries(["admin-apk-requests"]);
            setApproveOpen(false);
            onComplete?.();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Gagal menyetujui request");
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: async () => {
            const res = await api.patch(`/apk-requests/${requestId}/reject`, {
                message: feedback,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Request berhasil ditolak!");
            queryClient.invalidateQueries(["apk-request-detail", requestId]);
            queryClient.invalidateQueries(["admin-apk-requests"]);
            setRejectOpen(false);
            onComplete?.();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Gagal menolak request");
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="p-6 text-center">
                <Icon icon="mdi:alert-circle" className="text-red-500 text-4xl mx-auto mb-2" />
                <p className="text-slate-600">Gagal memuat data request</p>
                <button onClick={onBack} className="mt-4 text-blue-600 hover:underline">
                    Kembali
                </button>
            </div>
        );
    }

    const coordinator = order.coordinator;
    const items = order.items || [];

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <button onClick={onBack} className="inline-flex items-center gap-1 text-slate-500 mb-2 hover:text-slate-700">
                            <Icon icon="mdi:arrow-left" /> Kembali
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="text-xl font-bold text-slate-800">Permintaan APK</div>
                            <StatusChip statusCode={status} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{order.request_no || `#${order.id}`}</span> • {formatDateTime(order.created_at)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                <SectionCard title="Detail Koordinator" icon="mdi:account-circle-outline">
                    <div className="flex flex-col gap-1">
                        <div className="font-semibold text-slate-800 text-md">{coordinator?.nama || "-"}</div>
                        <div className="text-slate-600 text-sm flex items-center gap-2">
                            <Icon icon="mdi:phone" width={16} className="text-slate-400" />
                            {coordinator?.no_hp || "-"}
                        </div>
                        {coordinator?.alamat && (
                            <div className="text-slate-600 text-sm flex items-center gap-2">
                                <Icon icon="mdi:map-marker" width={16} className="text-slate-400" />
                                {coordinator.alamat}
                            </div>
                        )}
                    </div>
                </SectionCard>

                <SectionCard title="Detail Pengiriman" icon="mdi:map-marker-radius-outline">
                    <div className="flex flex-col gap-3">
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1">Alamat Penjemputan / Pengiriman</div>
                            <div className="text-sm text-slate-800 bg-slate-50 p-2 rounded border border-slate-100">
                                {order.pickup_address || coordinator?.alamat || "-"}
                            </div>
                        </div>
                        {order.description && (
                            <div>
                                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Catatan / Keperluan</div>
                                <div className="text-sm text-slate-800 bg-yellow-50 p-2 rounded border border-yellow-100 italic">
                                    "{order.description}"
                                </div>
                            </div>
                        )}
                    </div>
                </SectionCard>

                <SectionCard title={`Daftar Barang (${items.length})`} icon="mdi:package-variant-closed">
                    {items.length === 0 ? (
                        <div className="text-slate-400">-</div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-100 p-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-[16px] text-slate-900 truncate">{it.item?.name || "Item"}</div>
                                        {it.item?.bentuk?.name && <div className="text-[14px] text-slate-500">Bentuk: {it.item.bentuk.name}</div>}
                                        {it.note && <div className="text-[13px] text-slate-400 italic">{it.note}</div>}
                                    </div>
                                    <div className="text-sm font-bold text-slate-900">
                                        {it.qty} <span className="text-slate-500 font-semibold">{it.unit?.name || ""}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Show courier if approved */}
                {status === "APPROVED" && order.courier && (
                    <SectionCard title="Kurir Pengantar" icon="mdi:motorbike">
                        <div className="flex flex-col gap-1">
                            <div className="font-semibold text-slate-900">{order.courier?.nama || "-"}</div>
                            <div className="text-slate-600 text-sm flex items-center gap-2">
                                <Icon icon="mdi:phone" width={16} className="text-slate-400" />
                                {order.courier?.no_hp || "-"}
                            </div>
                        </div>
                    </SectionCard>
                )}
            </div>

            {/* Action bar (only when pending) */}
            {
                canAct && (
                    <div className="border-t border-slate-200 bg-white p-4 sticky bottom-0">
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setFeedback("");
                                    setRejectOpen(true);
                                }}
                                className="flex-1 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 transition"
                            >
                                <span className="inline-flex items-center gap-2 justify-center">
                                    <Icon icon="mdi:close-circle-outline" width={18} />
                                    Tolak
                                </span>
                            </button>

                            <button
                                onClick={() => {
                                    setSelectedCourierId(couriers[0]?.id?.toString() || "");
                                    // Use user's pickup_address if available, fallback to coordinator address
                                    setPickupAddress(order.pickup_address || coordinator?.alamat || "");
                                    setPickupDate(new Date().toISOString().slice(0, 16));
                                    setApproveOpen(true);
                                }}
                                className="flex-1 py-3 rounded-2xl bg-blue-900 text-white font-bold hover:bg-blue-800 transition"
                            >
                                <span className="inline-flex items-center gap-2 justify-center">
                                    <Icon icon="mdi:check-circle-outline" width={18} />
                                    Setujui
                                </span>
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Approve Modal */}
            <ModalShell
                open={approveOpen}
                onClose={() => setApproveOpen(false)}
                title="Setujui Permintaan"
                footer={
                    <div className="flex gap-3">
                        <button onClick={() => setApproveOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">
                            Batal
                        </button>
                        <button
                            onClick={() => approveMutation.mutate()}
                            disabled={!selectedCourierId || !pickupAddress || !pickupDate || approveMutation.isPending}
                            className="flex-1 py-2.5 rounded-xl bg-blue-900 text-white font-bold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {approveMutation.isPending ? "Menyetujui..." : "Konfirmasi"}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2">Pilih Kurir Pengantar *</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {couriers.map((c) => (
                                <label
                                    key={c.id}
                                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition ${selectedCourierId === c.id?.toString() ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                                >
                                    <div className="min-w-0">
                                        <div className="font-extrabold text-slate-900 truncate">{c.nama}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <Icon icon="mdi:phone" width={14} className="text-slate-400" />
                                            {c.no_hp}
                                        </div>
                                    </div>
                                    <input type="radio" name="courier" checked={selectedCourierId === c.id?.toString()} onChange={() => setSelectedCourierId(c.id?.toString())} />
                                </label>
                            ))}
                            {couriers.length === 0 && <div className="text-slate-400 text-sm p-3">Tidak ada kurir tersedia</div>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2">Alamat Penjemputan *</label>
                        <textarea
                            value={pickupAddress}
                            onChange={(e) => setPickupAddress(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder="Alamat pengambilan barang..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-2">Jadwal Pengambilan *</label>
                        <input
                            type="datetime-local"
                            value={pickupDate}
                            onChange={(e) => setPickupDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                </div>
            </ModalShell>

            {/* Reject Modal */}
            <ModalShell
                open={rejectOpen}
                onClose={() => setRejectOpen(false)}
                title="Tolak Permintaan"
                footer={
                    <div className="flex gap-3">
                        <button onClick={() => setRejectOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">
                            Batal
                        </button>
                        <button
                            onClick={() => rejectMutation.mutate()}
                            disabled={!feedback.trim() || rejectMutation.isPending}
                            className={`flex-1 py-2.5 rounded-xl font-bold transition ${feedback.trim() ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                        >
                            {rejectMutation.isPending ? "Menolak..." : "Kirim Feedback"}
                        </button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <div className="text-sm text-slate-600">Jelaskan alasan penolakan (stok kosong, item tidak tersedia, dll).</div>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={5}
                        className="w-full rounded-2xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                        placeholder="Tulis feedback untuk koordinator…"
                    />
                </div>
            </ModalShell>
        </div >
    );
}
