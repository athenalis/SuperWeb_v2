
import React, { useState } from "react";
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
    const base = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shadow-sm";

    const statusMap = {
        SUBMITTED: { icon: "mdi:clock", label: "Menunggu", classes: "bg-amber-50 text-amber-700 border-amber-200" },
        REVISED: { icon: "mdi:pencil", label: "Direvisi", classes: "bg-orange-50 text-orange-700 border-orange-200" },
        APPROVED: { icon: "mdi:check-circle", label: "Disetujui", classes: "bg-green-50 text-green-700 border-green-200" },
        REJECTED: { icon: "mdi:close-circle", label: "Ditolak", classes: "bg-rose-50 text-rose-700 border-rose-200" },
        PICKED_UP: { icon: "mdi:truck", label: "Diambil Kurir", classes: "bg-indigo-50 text-indigo-700 border-indigo-200" },
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
                    {icon && <Icon icon={icon} className="text-blue-900" width={18} />}
                    <div className="font-extrabold text-slate-900">{title}</div>
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
            <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div className="text-lg font-extrabold text-slate-900">{title}</div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
                        <Icon icon="mdi:close" width={20} />
                    </button>
                </div>
                <div className="p-5 max-h-[60vh] overflow-y-auto">{children}</div>
                {footer && <div className="p-5 border-t border-slate-100 bg-white">{footer}</div>}
            </div>
        </div>,
        document.getElementById("modal-root") || document.body
    );
}

export default function KoordinatorApkRequestView({ requestId, onComplete, onBack }) {
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

    // Fetch APK items for revise
    const { data: apkItems = [] } = useQuery({
        queryKey: ["apk-items"],
        queryFn: async () => {
            const res = await api.get("/apk/items");
            return res.data?.data || res.data || [];
        },
    });

    // Fetch units
    const { data: units = [] } = useQuery({
        queryKey: ["units"],
        queryFn: async () => {
            const res = await api.get("/units");
            return res.data?.data || res.data || [];
        },
    });

    const order = requestData;
    const status = order?.status?.code;
    const canEdit = status === "REJECTED";
    const canConfirmDelivered = status === "ARRIVED" || status === "PICKED_UP";

    // Edit modal state
    const [editOpen, setEditOpen] = useState(false);
    const [draftItems, setDraftItems] = useState([]);

    // Revise items mutation
    const reviseMutation = useMutation({
        mutationFn: async (items) => {
            const res = await api.patch(`/apk-requests/${requestId}/revise-items`, { items });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Item berhasil direvisi!");
            queryClient.invalidateQueries(["apk-request-detail", requestId]);
            setEditOpen(false);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Gagal merevisi item");
        },
    });

    // Resubmit mutation
    const resubmitMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/apk-requests/${requestId}/resubmit`);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Request berhasil diajukan ulang!");
            queryClient.invalidateQueries(["apk-request-detail", requestId]);
            queryClient.invalidateQueries(["my-apk-requests"]);
            onComplete?.();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Gagal mengajukan ulang");
        },
    });

    // Confirm delivered mutation
    const deliveredMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/apk-requests/${requestId}/delivered`);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Barang berhasil dikonfirmasi diterima!");
            queryClient.invalidateQueries(["apk-request-detail", requestId]);
            queryClient.invalidateQueries(["my-apk-requests"]);
            onComplete?.();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Gagal konfirmasi");
        },
    });

    const handleOpenEdit = () => {
        const items = order?.items || [];
        setDraftItems(
            items.map((it) => ({
                item_id: it.item_id,
                qty: it.qty,
                unit_id: it.unit_id,
                note: it.note || "",
            }))
        );
        setEditOpen(true);
    };

    const updateDraftItem = (idx, patch) => {
        setDraftItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    };

    const removeDraftItem = (idx) => {
        setDraftItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const addDraftItem = () => {
        setDraftItems((prev) => [...prev, { item_id: "", qty: 1, unit_id: "", note: "" }]);
    };

    const handleReviseAndResubmit = async () => {
        // Validate
        const validItems = draftItems.filter((it) => it.item_id && it.qty > 0 && it.unit_id);
        if (validItems.length === 0) {
            toast.error("Minimal harus ada 1 item valid");
            return;
        }

        // Revise items first
        await reviseMutation.mutateAsync(validItems);
        // Then resubmit
        await resubmitMutation.mutateAsync();
    };

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

    const items = order.items || [];
    const courier = order.courier;
    const histories = order.histories || [];

    // Get rejection feedback from history
    const rejectionHistory = histories.find((h) => h.status?.code === "REJECTED");
    const rejectionMessage = rejectionHistory?.note || "";

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
                            <div className="text-xl font-extrabold text-slate-900">Status Permintaan APK</div>
                            <StatusChip statusCode={status} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{order.request_no || `#${order.id}`}</span> • {formatDateTime(order.created_at)}
                            {order.revision_no > 1 && <span className="ml-2 text-orange-600">(Revisi ke-{order.revision_no})</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {/* Approved: show courier */}
                {(status === "APPROVED" || status === "PICKED_UP" || status === "ARRIVED" || status === "DELIVERED") && courier && (
                    <SectionCard title="Kurir Pengantar" icon="mdi:motorbike">
                        <div className="flex flex-col gap-1">
                            <div className="font-semibold text-slate-900">{courier.nama || "-"}</div>
                            <div className="text-slate-600 text-sm flex items-center gap-2">
                                <Icon icon="mdi:phone" width={16} className="text-slate-400" />
                                {courier.no_hp || "-"}
                            </div>
                        </div>
                    </SectionCard>
                )}

                {/* Rejected: show feedback */}
                {status === "REJECTED" && (
                    <SectionCard
                        title="Permintaan Ditolak"
                        icon="mdi:message-alert-outline"
                        right={
                            <button onClick={handleOpenEdit} className="text-xs font-extrabold text-blue-700 hover:text-blue-900">
                                Edit & Kirim Ulang
                            </button>
                        }
                    >
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-rose-800">
                            {rejectionMessage || <span className="text-rose-400">Tidak ada feedback.</span>}
                        </div>
                        <div className="mt-3 text-xs text-slate-500">Klik "Edit & Kirim Ulang" untuk merevisi dan mengajukan kembali.</div>
                    </SectionCard>
                )}

                {/* Items */}
                <SectionCard title={`Daftar Barang (${items.length})`} icon="mdi:package-variant-closed">
                    {items.length === 0 ? (
                        <div className="text-slate-400">-</div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-100 p-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-slate-900 truncate">{it.item?.name || "Item"}</div>
                                        {it.item?.bentuk?.name && <div className="text-xs text-slate-500">Bentuk: {it.item.bentuk.name}</div>}
                                        {it.note && <div className="text-xs text-slate-400 italic">{it.note}</div>}
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-900">
                                        {it.qty} <span className="text-slate-500 font-bold">{it.unit?.name || ""}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                {/* Status info */}
                {status === "APPROVED" && (
                    <div className="text-xs text-slate-500 px-1">Pesanan sudah disetujui. Menunggu kurir mengambil barang.</div>
                )}
                {status === "PICKED_UP" && (
                    <div className="text-xs text-slate-500 px-1">Barang sudah diambil kurir. Tunggu barang sampai tujuan.</div>
                )}
                {status === "ARRIVED" && (
                    <div className="text-xs text-green-600 px-1 font-semibold">Barang sudah sampai! Silakan konfirmasi penerimaan.</div>
                )}
                {status === "DELIVERED" && (
                    <div className="text-xs text-emerald-600 px-1 font-semibold">✓ Barang sudah diterima.</div>
                )}
            </div>

            {/* Action: Confirm Delivered */}
            {canConfirmDelivered && (
                <div className="border-t border-slate-200 bg-white p-4 sticky bottom-0">
                    <button
                        onClick={() => deliveredMutation.mutate()}
                        disabled={deliveredMutation.isPending}
                        className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                        {deliveredMutation.isPending ? "Mengkonfirmasi..." : "Konfirmasi Barang Diterima"}
                    </button>
                </div>
            )}

            {/* Edit Modal */}
            <ModalShell
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title="Edit & Kirim Ulang"
                footer={
                    <div className="flex gap-3">
                        <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">
                            Batal
                        </button>
                        <button
                            onClick={handleReviseAndResubmit}
                            disabled={reviseMutation.isPending || resubmitMutation.isPending || draftItems.length === 0}
                            className="flex-1 py-2.5 rounded-xl bg-blue-900 text-white font-extrabold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {reviseMutation.isPending || resubmitMutation.isPending ? "Mengirim..." : "Kirim Ulang"}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-extrabold text-slate-900">Daftar Barang</div>
                        <button onClick={addDraftItem} className="text-xs font-extrabold text-blue-700 hover:text-blue-900">
                            + Tambah Item
                        </button>
                    </div>

                    <div className="space-y-3">
                        {draftItems.map((it, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500">Item #{idx + 1}</span>
                                    <button onClick={() => removeDraftItem(idx)} className="text-rose-600 hover:text-rose-800">
                                        <Icon icon="mdi:trash-can-outline" width={18} />
                                    </button>
                                </div>
                                <select
                                    value={it.item_id}
                                    onChange={(e) => {
                                        const selectedItem = apkItems.find((i) => i.id === parseInt(e.target.value));
                                        updateDraftItem(idx, {
                                            item_id: e.target.value,
                                            unit_id: selectedItem?.unit_id?.toString() || "",
                                        });
                                    }}
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="">-- Pilih Barang --</option>
                                    {apkItems.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name} {item.bentuk?.name ? `(${item.bentuk.name})` : ""}
                                        </option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        value={it.qty}
                                        onChange={(e) => updateDraftItem(idx, { qty: parseFloat(e.target.value) || 0 })}
                                        className="w-full rounded-xl border border-slate-200 p-2 text-sm"
                                        placeholder="Jumlah"
                                    />
                                    <select
                                        value={it.unit_id}
                                        onChange={(e) => updateDraftItem(idx, { unit_id: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 p-2 text-sm"
                                    >
                                        <option value="">-- Satuan --</option>
                                        {units.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    value={it.note || ""}
                                    onChange={(e) => updateDraftItem(idx, { note: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm"
                                    placeholder="Catatan (opsional)"
                                />
                            </div>
                        ))}

                        {draftItems.length === 0 && <div className="text-center text-slate-400 py-4">Belum ada item. Klik "+ Tambah Item"</div>}
                    </div>
                </div>
            </ModalShell>
        </div>
    );
}
