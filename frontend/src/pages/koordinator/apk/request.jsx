import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { toast } from "react-hot-toast";
import api from "../../../lib/axios";

export default function RequestApk() {
    const queryClient = useQueryClient();

    // === CART STATE (harus di atas useMemo yang menggunakannya) ===
    const [cart, setCart] = useState([]);
    const [itemForm, setItemForm] = useState({
        category: "",
        bentuk_id: "",
        item_id: "",
        qty: "",
        unit_id: "",
        note: ""
    });

    // === FETCH APK BENTUKS (Kategori + Bentuk) ===
    const { data: bentuks = [], isLoading: loadingBentuks } = useQuery({
        queryKey: ["apk-bentuks"],
        queryFn: async () => {
            const res = await api.get("/apk/bentuks");
            console.log("[DEBUG] Bentuks response:", res.data);
            return res.data?.data || res.data || [];
        },
    });

    // === FETCH APK ITEMS (Nama Barang) ===
    const { data: apkItems = [], isLoading: loadingItems } = useQuery({
        queryKey: ["apk-items"],
        queryFn: async () => {
            const res = await api.get("/apk/items");
            console.log("[DEBUG] APK Items response:", res.data);
            return res.data?.data || res.data || [];
        },
    });

    // === FETCH UNITS ===
    const { data: units = [], isLoading: loadingUnits } = useQuery({
        queryKey: ["units"],
        queryFn: async () => {
            const res = await api.get("/units");
            return res.data?.data || res.data || [];
        },
    });

    // === FETCH MY REQUESTS (Riwayat) ===
    const { data: requestsData, isLoading: loadingRequests, refetch: refetchRequests } = useQuery({
        queryKey: ["my-apk-requests"],
        queryFn: async () => {
            const res = await api.get("/apk-requests");
            return res.data;
        },
    });

    const requests = requestsData?.data || [];

    // === DERIVED DATA ===
    // Get unique categories from bentuks (only active ones)
    const categories = useMemo(() => {
        const activeCategories = bentuks
            .filter(b => b.is_active === true || b.is_active === 1)
            .map(b => b.category);
        const uniqueCategories = [...new Set(activeCategories)];
        return uniqueCategories.map(cat => ({
            value: cat,
            label: cat === "apk" ? "APK (Alat Peraga Kampanye)" : "Bahan Kampanye"
        }));
    }, [bentuks]);

    // Filter bentuks by selected category (only active)
    const filteredBentuks = useMemo(() => {
        if (!itemForm.category) return [];
        return bentuks.filter(b =>
            b.category === itemForm.category &&
            (b.is_active === true || b.is_active === 1)
        );
    }, [bentuks, itemForm.category]);

    // Filter items by selected bentuk (only active)
    const filteredItems = useMemo(() => {
        if (!itemForm.bentuk_id) return [];
        return apkItems.filter(item =>
            item.bentuk_id === parseInt(itemForm.bentuk_id) &&
            (item.is_active === true || item.is_active === 1)
        );
    }, [apkItems, itemForm.bentuk_id]);

    // === SUBMIT MUTATION ===
    const submitMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await api.post("/apk-requests", payload);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Permintaan berhasil diajukan!");
            setCart([]);
            queryClient.invalidateQueries(["my-apk-requests"]);
        },
        onError: (err) => {
            const msg = err.response?.data?.message || "Gagal mengajukan permintaan";
            toast.error(msg);
        },
    });

    // === HANDLERS ===
    const handleCategoryChange = (e) => {
        setItemForm({
            ...itemForm,
            category: e.target.value,
            bentuk_id: "",
            item_id: "",
            unit_id: ""
        });
    };

    const handleBentukChange = (e) => {
        setItemForm({
            ...itemForm,
            bentuk_id: e.target.value,
            item_id: "",
            unit_id: ""
        });
    };

    const handleItemChange = (e) => {
        const selectedItemId = e.target.value;
        const selectedItem = apkItems.find(i => i.id === parseInt(selectedItemId));

        setItemForm({
            ...itemForm,
            item_id: selectedItemId,
            // Auto-fill unit_id from item if available
            unit_id: selectedItem?.unit_id?.toString() || ""
        });
    };

    const handleAddItem = (e) => {
        e.preventDefault();
        if (!itemForm.item_id || !itemForm.qty || !itemForm.unit_id) {
            toast.error("Mohon lengkapi data barang");
            return;
        }

        const selectedItem = apkItems.find((i) => i.id === parseInt(itemForm.item_id));
        const selectedUnit = units.find((u) => u.id === parseInt(itemForm.unit_id));
        const selectedBentuk = bentuks.find((b) => b.id === parseInt(itemForm.bentuk_id));

        // Check for duplicate
        const exists = cart.find(c => c.item_id === parseInt(itemForm.item_id));
        if (exists) {
            toast.error("Item sudah ada dalam daftar, silakan hapus dulu jika ingin mengubah");
            return;
        }

        setCart([
            ...cart,
            {
                id: Date.now(),
                item_id: parseInt(itemForm.item_id),
                item_name: selectedItem?.name || "Unknown",
                bentuk_name: selectedBentuk?.name || "",
                category: itemForm.category === "apk" ? "APK" : "Bahan Kampanye",
                qty: parseFloat(itemForm.qty),
                unit_id: parseInt(itemForm.unit_id),
                unit_name: selectedUnit?.name || "",
                note: itemForm.note,
            },
        ]);
        setItemForm({ category: "", bentuk_id: "", item_id: "", qty: "", unit_id: "", note: "" });
    };

    const handleRemoveItem = (id) => setCart(cart.filter((item) => item.id !== id));

    const handleFinalSubmit = () => {
        if (cart.length === 0) return toast.error("Daftar barang kosong");

        const payload = {
            items: cart.map((c) => ({
                item_id: c.item_id,
                qty: c.qty,
                unit_id: c.unit_id,
                note: c.note || null,
            })),
        };

        submitMutation.mutate(payload);
    };

    // === STATUS HELPER ===
    const getStatusInfo = (statusCode) => {
        const map = {
            SUBMITTED: { label: "Menunggu", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", indicator: "bg-yellow-400" },
            APPROVED: { label: "Disetujui", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", indicator: "bg-blue-500" },
            REJECTED: { label: "Ditolak", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", indicator: "bg-red-500" },
            REVISED: { label: "Direvisi", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", indicator: "bg-orange-400" },
            PICKED_UP: { label: "Diambil Kurir", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", indicator: "bg-indigo-500" },
            ARRIVED: { label: "Sampai", bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", indicator: "bg-teal-500" },
            DELIVERED: { label: "Diterima", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", indicator: "bg-emerald-500" },
        };
        return map[statusCode] || { label: statusCode, bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", indicator: "bg-gray-400" };
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    if (loadingBentuks || loadingItems || loadingUnits) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Formulir Permintaan Logistik APK</h1>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* LEFT: INPUT AREA */}
                <div className="space-y-6">
                    {/* CARD 1: FORM BARANG */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                            <Icon icon="mdi:package-variant-plus" className="text-blue-600 text-xl" />
                            1. Input Item Barang
                        </h2>
                        <form onSubmit={handleAddItem} className="space-y-4">
                            {/* Row 1: Kategori & Bentuk */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Kategori <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={itemForm.category}
                                        onChange={handleCategoryChange}
                                        required
                                    >
                                        <option value="">- Pilih Kategori -</option>
                                        {categories.map((cat) => (
                                            <option key={cat.value} value={cat.value}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Bentuk <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        value={itemForm.bentuk_id}
                                        onChange={handleBentukChange}
                                        disabled={!itemForm.category}
                                        required
                                    >
                                        <option value="">- Pilih Bentuk -</option>
                                        {filteredBentuks.map((bentuk) => (
                                            <option key={bentuk.id} value={bentuk.id}>
                                                {bentuk.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Row 2: Nama Barang & Satuan */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Nama Barang <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        value={itemForm.item_id}
                                        onChange={handleItemChange}
                                        disabled={!itemForm.bentuk_id}
                                        required
                                    >
                                        <option value="">- Pilih Nama Barang -</option>
                                        {filteredItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} {item.stock > 0 ? `(Stok: ${item.stock})` : "(Stok habis)"}
                                            </option>
                                        ))}
                                    </select>
                                    {filteredItems.length === 0 && itemForm.bentuk_id && (
                                        <p className="text-xs text-orange-500 mt-1">
                                            Tidak ada barang untuk bentuk ini
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Satuan <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={itemForm.unit_id}
                                        onChange={(e) => setItemForm({ ...itemForm, unit_id: e.target.value })}
                                        required
                                    >
                                        <option value="">- Pilih Satuan -</option>
                                        {units.map((unit) => (
                                            <option key={unit.id} value={unit.id}>
                                                {unit.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Row 3: Jumlah & Keterangan */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Jumlah <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={itemForm.qty}
                                        onChange={(e) => setItemForm({ ...itemForm, qty: e.target.value })}
                                        placeholder="0"
                                        min="1"
                                        step="1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Keterangan (Opsional)</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={itemForm.note}
                                        onChange={(e) => setItemForm({ ...itemForm, note: e.target.value })}
                                        placeholder="Detail tambahan..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
                                >
                                    <Icon icon="mdi:plus" className="text-lg" />
                                    Tambah Item
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* CARD 2: LIST KERANJANG */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                <Icon icon="mdi:cart-outline" className="text-blue-600 text-xl" />
                                2. Daftar Item Request
                            </h2>
                            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                {cart.length} item
                            </span>
                        </div>

                        {cart.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                <Icon icon="mdi:package-variant-remove" className="text-4xl mx-auto mb-2 text-slate-300" />
                                Belum ada item yang ditambahkan.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 font-medium">
                                        <tr>
                                            <th className="p-3 rounded-l-lg">Barang</th>
                                            <th className="p-3">Bentuk</th>
                                            <th className="p-3">Qty</th>
                                            <th className="p-3">Satuan</th>
                                            <th className="p-3 rounded-r-lg text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {cart.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50 transition">
                                                <td className="p-3">
                                                    <div className="font-medium text-slate-800">{item.item_name}</div>
                                                    <div className="text-xs text-slate-400">{item.category}</div>
                                                    {item.note && <div className="text-xs text-slate-500 mt-0.5">{item.note}</div>}
                                                </td>
                                                <td className="p-3 text-slate-600">{item.bentuk_name}</td>
                                                <td className="p-3 font-semibold text-slate-800">{item.qty}</td>
                                                <td className="p-3 text-slate-600">{item.unit_name}</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="text-red-600 hover:text-red-800 text-xs font-medium hover:underline"
                                                    >
                                                        Hapus
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* CARD 3: SUBMIT */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                            <Icon icon="mdi:send-check" className="text-blue-600 text-xl" />
                            3. Kirim Permintaan
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Pastikan semua item sudah benar sebelum mengirim permintaan. Permintaan akan diteruskan ke Admin APK untuk disetujui.
                        </p>
                        <button
                            onClick={handleFinalSubmit}
                            disabled={submitMutation.isPending || cart.length === 0}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                        >
                            {submitMutation.isPending ? (
                                <>
                                    <Icon icon="mdi:loading" className="animate-spin text-lg" />
                                    Mengirim...
                                </>
                            ) : (
                                <>
                                    <Icon icon="mdi:send" className="text-lg" />
                                    Kirim Permintaan Sekarang
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* RIGHT: HISTORY SIDEBAR */}
                <div className="h-fit">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Icon icon="mdi:history" className="text-blue-600" />
                            Riwayat Permintaan
                        </h2>
                        <button
                            onClick={() => refetchRequests()}
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            <Icon icon="mdi:refresh" />
                            Refresh
                        </button>
                    </div>

                    {loadingRequests ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                            <Icon icon="mdi:inbox-outline" className="text-5xl text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">Belum ada permintaan</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                            {requests.map((req) => {
                                const statusInfo = getStatusInfo(req.status?.code);
                                return (
                                    <div
                                        key={req.id}
                                        className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition ${statusInfo.border}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className="font-mono text-xs font-bold text-slate-500">
                                                    {req.request_no || `#${req.id}`}
                                                </span>
                                                {req.revision_no > 1 && (
                                                    <span className="ml-2 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                                        Rev. {req.revision_no}
                                                    </span>
                                                )}
                                            </div>
                                            <span
                                                className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${statusInfo.bg} ${statusInfo.text}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.indicator}`}></span>
                                                {statusInfo.label}
                                            </span>
                                        </div>

                                        <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                                            <Icon icon="mdi:calendar" />
                                            {formatDate(req.created_at)}
                                        </div>

                                        {/* Items */}
                                        <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1.5">
                                            {req.items?.map((item, i) => (
                                                <div key={i} className="flex justify-between">
                                                    <span className="text-slate-700">
                                                        • {item.item?.name || "Item"}
                                                        {item.item?.bentuk?.name && (
                                                            <span className="text-slate-400 ml-1">({item.item.bentuk.name})</span>
                                                        )}
                                                        {item.note && <span className="text-slate-400 ml-1">- {item.note}</span>}
                                                    </span>
                                                    <span className="font-semibold text-slate-800">
                                                        {item.qty} {item.unit?.name || ""}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Courier info if assigned */}
                                        {req.courier && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                                                <div className="flex items-center gap-1 text-slate-600">
                                                    <Icon icon="mdi:truck-delivery" className="text-blue-500" />
                                                    <span className="font-medium">{req.courier.nama}</span>
                                                    <span className="text-slate-400">• {req.courier.no_hp}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
