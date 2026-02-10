// kelolabarang.jsx
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import axios from "../../lib/axios";

export default function KelolaBarang() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("bentuk"); // bentuk | item | stok

  /* =========================
    DATA (TAB ITEM)
  ========================= */
  const [bentuks, setBentuks] = useState([]);
  const [units, setUnits] = useState([]);
  const [loadingBentuks, setLoadingBentuks] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // filter bentuk berdasarkan category
  const [selectedCategory, setSelectedCategory] = useState("");

  /* =========================
    DATA (TAB STOK)
  ========================= */
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  /* =========================
    TAB 1: TAMBAH BENTUK
  ========================= */
  const [bentukForm, setBentukForm] = useState({
    category: "apk",
    name: "",
  });
  const [isSavingBentuk, setIsSavingBentuk] = useState(false);

  const submitTambahBentuk = async () => {
    if (!bentukForm.category) return toast.error("Category wajib dipilih.");
    if (!bentukForm.name?.trim()) return toast.error("Nama bentuk wajib diisi.");

    try {
      setIsSavingBentuk(true);

      const payload = {
        category: bentukForm.category,
        name: bentukForm.name.trim(),
      };

      await axios.post("/apk/bentuk", payload);

      toast.success("Bentuk berhasil ditambahkan.");
      setBentukForm({ category: "apk", name: "" });
    } catch (err) {
      console.log("ERR:", err);
      console.log("RES:", err?.response);
      const msg =
        err?.response?.data?.message || err?.message || "Gagal menambahkan bentuk.";
      toast.error(msg);
    } finally {
      setIsSavingBentuk(false);
    }
  };

  /* =========================
    TAB 2: TAMBAH ITEM
  ========================= */
  const [itemForm, setItemForm] = useState({
    bentuk_id: "",
    name: "",
    unit_id: "",
    stock: 0,
    budget_total: 0,
    budget_note: "",
    description: "",
    is_active: true,
  });
  const [isSavingItem, setIsSavingItem] = useState(false);

  /* =========================
    TAB 3: TAMBAH STOCK (IN)
  ========================= */
  const [stokForm, setStokForm] = useState({
    item_id: "",
    qty: "",
    total_cost: 0,
    note: "",
  });
  const [isSavingStock, setIsSavingStock] = useState(false);

  const selectedItemStock = useMemo(() => {
    return (items || []).find((x) => String(x.id) === String(stokForm.item_id));
  }, [items, stokForm.item_id]);

  const submitTambahStock = async () => {
    if (!stokForm.item_id) return toast.error("Item wajib dipilih.");
    if (!stokForm.qty) return toast.error("Qty wajib diisi.");

    try {
      setIsSavingStock(true);

      const payload = {
        item_id: Number(stokForm.item_id),
        qty: Number(stokForm.qty),
        total_cost: Number(stokForm.total_cost || 0),
        note: stokForm.note || "",
      };

      await axios.post("/apk/stock/in", payload);

      toast.success("Stock berhasil ditambahkan.");
      setStokForm({ item_id: "", qty: "", total_cost: 0, note: "" });

      // refresh list items biar stok terbaru kebaca
      await fetchItems();
    } catch (err) {
      console.log("ERR:", err);
      console.log("RES:", err?.response);
      const msg =
        err?.response?.data?.message || err?.message || "Gagal menambahkan stock.";
      toast.error(msg);
    } finally {
      setIsSavingStock(false);
    }
  };

  /* =========================
    FETCHERS (dipake ulang)
  ========================= */
  const normalizeList = (res) => {
    // support: array langsung atau { data: [...] }
    return Array.isArray(res?.data) ? res.data : res?.data?.data || [];
  };

  const fetchBentuks = async () => {
    try {
      setLoadingBentuks(true);
      const res = await axios.get("/apk/bentuks");
      setBentuks(normalizeList(res));
    } catch (e) {
      toast.error("Gagal load bentuk.");
    } finally {
      setLoadingBentuks(false);
    }
  };

  const fetchUnits = async () => {
    try {
      setLoadingUnits(true);
      const res = await axios.get("/units");
      setUnits(normalizeList(res));
    } catch (e) {
      toast.error("Gagal load unit.");
    } finally {
      setLoadingUnits(false);
    }
  };

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await axios.get("/apk/items");
      setItems(normalizeList(res));
    } catch (e) {
      toast.error("Gagal load items.");
    } finally {
      setLoadingItems(false);
    }
  };

  /* =========================
    LOAD DATA PER TAB
  ========================= */
  useEffect(() => {
    if (activeTab === "item") {
      fetchBentuks();
      fetchUnits();
    }
    if (activeTab === "stok") {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // category options dari bentuks (unique)
  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set((bentuks || []).map((b) => b.category))).filter(Boolean);
    if (!cats.length) return ["apk", "bahan kampanye"];
    return cats;
  }, [bentuks]);

  // filter bentuk berdasarkan category terpilih
  const bentukOptionsFiltered = useMemo(() => {
    if (!selectedCategory) return [];
    return (bentuks || []).filter(
      (b) => String(b.category) === String(selectedCategory)
    );
  }, [bentuks, selectedCategory]);

  // kalau category berubah: reset bentuk_id
  useEffect(() => {
    setItemForm((p) => ({ ...p, bentuk_id: "" }));
  }, [selectedCategory]);

  const submitTambahItem = async () => {
    if (!selectedCategory) return toast.error("Category wajib dipilih.");
    if (!itemForm.bentuk_id) return toast.error("Bentuk wajib dipilih.");
    if (!itemForm.name?.trim()) return toast.error("Nama barang wajib diisi.");
    if (!itemForm.unit_id) return toast.error("Satuan wajib dipilih.");

    try {
      setIsSavingItem(true);

      const payload = {
        bentuk_id: Number(itemForm.bentuk_id),
        name: itemForm.name.trim(),
        unit_id: Number(itemForm.unit_id),
        stock: Number(itemForm.stock || 0),
        budget_total: Number(itemForm.budget_total || 0),
        budget_note: itemForm.budget_note || "",
        description: itemForm.description || "",
        is_active: !!itemForm.is_active,
      };

      await axios.post("/apk/items", payload);

      toast.success("Item berhasil ditambahkan.");
      setItemForm({
        bentuk_id: "",
        name: "",
        unit_id: "",
        stock: 0,
        budget_total: 0,
        budget_note: "",
        description: "",
        is_active: true,
      });
    } catch (err) {
      console.log("ERR:", err);
      console.log("RES:", err?.response);
      const msg =
        err?.response?.data?.message || err?.message || "Gagal menambahkan item.";
      toast.error(msg);
    } finally {
      setIsSavingItem(false);
    }
  };

  /* =========================
    UI HELPERS
  ========================= */
  const tabBtnBase =
    "flex-1 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 border";
  const tabBtnActive = "bg-blue-600 text-white border-blue-600 shadow-sm";
  const tabBtnIdle =
    "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";

  const cardClass =
    "bg-white rounded-xl border border-slate-200 overflow-hidden";
  const cardHeaderClass = "p-6 border-b border-slate-200 bg-slate-50";
  const cardBodyClass = "p-6";

  const labelClass = "block text-md font-medium text-slate-700 mb-1";
  const inputClass =
    "w-full appearance-none px-6 py-3 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const primaryBtn =
    "px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm";
  const ghostBtn =
    "px-5 py-2.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-sm";

  return (
    <div className="min-h-screen bg-slate-50 border border-slate-200 rounded-xl p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-1 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Kembali"
          >
            <Icon icon="mdi:arrow-left" width={22} className="text-slate-700" />
          </button>

          <div>
            <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-3">
              Kelola Barang
            </h1>
            <p className="text-slate-500 mt-1">
              Tambah bentuk, tambah item, dan tambah stock.
            </p>
          </div>
        </div>
      </div>

      {/* NAV TAB */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 flex gap-2">
        <button
          type="button"
          className={`${tabBtnBase} ${activeTab === "bentuk" ? tabBtnActive : tabBtnIdle}`}
          onClick={() => setActiveTab("bentuk")}
        >
          <Icon icon="solar:box-linear" width={20} />
          Tambah Bentuk
        </button>

        <button
          type="button"
          className={`${tabBtnBase} ${activeTab === "item" ? tabBtnActive : tabBtnIdle}`}
          onClick={() => setActiveTab("item")}
        >
          <Icon icon="material-symbols:box-add-outline-rounded" width={20} />
          Tambah Item
        </button>

        <button
          type="button"
          className={`${tabBtnBase} ${activeTab === "stok" ? tabBtnActive : tabBtnIdle}`}
          onClick={() => setActiveTab("stok")}
        >
          <Icon icon="ci:list-add" width={20} />
          Tambah Stock
        </button>
      </div>

      {/* TAB: TAMBAH BENTUK */}
      {activeTab === "bentuk" && (
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h2 className="text-2xl font-bold text-blue-800 flex items-center gap-4">
              <Icon icon="solar:box-linear" width={25} className="text-blue-600" />
              Tambah Bentuk
            </h2>
            <p className="text-slate-500 mt-1">
              Tambah bentuk sesuai dengan kategori yang ada
            </p>
          </div>

          <div className={cardBodyClass}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  Kategori <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={bentukForm.category}
                    onChange={(e) =>
                      setBentukForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">Pilih Kategori</option>
                    <option value="apk">APK (Alat Peraga Kampanye)</option>
                    <option value="bahan_kampanye">Bahan Kampanye</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Nama Bentuk <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Spanduk"
                  value={bentukForm.name}
                  onChange={(e) =>
                    setBentukForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={primaryBtn}
                disabled={isSavingBentuk}
                onClick={submitTambahBentuk}
              >
                <span className="inline-flex items-center gap-2">
                  {isSavingBentuk ? "Menyimpan..." : "Simpan"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TAMBAH ITEM */}
      {activeTab === "item" && (
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h2 className="text-2xl font-bold text-blue-800 flex items-center gap-4">
              <Icon
                icon="material-symbols:box-add-outline-rounded"
                width={25}
                className="text-blue-600"
              />
              Tambah Item
            </h2>
            <p className="text-slate-500 mt-1">
              Dropdown bentuk akan muncul sesuai dengan kategori yang dipilih
            </p>
          </div>

          <div className={cardBodyClass}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  Kategori <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={inputClass}
                    disabled={loadingBentuks}
                  >
                    <option value="">
                      {loadingBentuks ? "Loading..." : "Pilih Kategori"}
                    </option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Bentuk <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={itemForm.bentuk_id}
                    onChange={(e) =>
                      setItemForm((p) => ({ ...p, bentuk_id: e.target.value }))
                    }
                    className={inputClass}
                    disabled={!selectedCategory || loadingBentuks}
                  >
                    <option value="">
                      {!selectedCategory
                        ? "Pilih Bentuk"
                        : loadingBentuks
                          ? "Loading..."
                          : "Pilih Bentuk"}
                    </option>
                    {bentukOptionsFiltered.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Nama Barang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Spanduk 2x1 m"
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Satuan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={itemForm.unit_id}
                    onChange={(e) =>
                      setItemForm((p) => ({ ...p, unit_id: e.target.value }))
                    }
                    className={inputClass}
                    disabled={loadingUnits}
                  >
                    <option value="">
                      {loadingUnits ? "Loading..." : "Pilih Satuan"}
                    </option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Stock <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={itemForm.stock}
                  onChange={(e) =>
                    setItemForm((p) => ({
                      ...p,
                      stock: Number(e.target.value || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Budget Total <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={itemForm.budget_total}
                  onChange={(e) =>
                    setItemForm((p) => ({
                      ...p,
                      budget_total: Number(e.target.value || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Budget Note <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Contoh: Budget awal"
                  value={itemForm.budget_note}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, budget_note: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="lg:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Spanduk ukuran 2x1 meter"
                  value={itemForm.description}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={primaryBtn}
                disabled={isSavingItem}
                onClick={submitTambahItem}
              >
                <span className="inline-flex items-center gap-2">
                  {isSavingItem ? "Menyimpan..." : "Simpan"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TAMBAH STOCK */}
      {activeTab === "stok" && (
        <div className={cardClass}>
          <div className={cardHeaderClass}>
            <h2 className="text-2xl font-bold text-blue-800 flex items-center gap-4">
              <Icon icon="ci:list-add" width={25} className="text-blue-600" />
              Tambah Stok
            </h2>
            <p className="text-slate-500 mt-1">
              Tambah item dan stok
            </p>
          </div>

          <div className={cardBodyClass}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="lg:col-span-2">
                <label className={labelClass}>
                  Nama Item <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={stokForm.item_id}
                    onChange={(e) =>
                      setStokForm((p) => ({ ...p, item_id: e.target.value }))
                    }
                    className={inputClass}
                    disabled={loadingItems}
                  >
                    <option value="">
                      {loadingItems ? "Loading..." : "Pilih Item"}
                    </option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it?.bentuk?.name || "-"})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItemStock && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm">
                      <div className="font-semibold text-slate-800">
                        {selectedItemStock.name} ({selectedItemStock?.bentuk?.name || "-"})
                      </div>
                      <div className="text-xs text-slate-500">
                        Stok sekarang:{" "}
                        <b>{selectedItemStock?.stock?.qty_current ?? "-"}</b>{" "}
                        {selectedItemStock?.unit?.name || ""}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  Jumlah <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 15"
                  value={stokForm.qty}
                  onChange={(e) =>
                    setStokForm((p) => ({ ...p, qty: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Budget Total <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={stokForm.total_cost}
                  onChange={(e) =>
                    setStokForm((p) => ({
                      ...p,
                      total_cost: Number(e.target.value || 0),
                    }))
                  }
                  className={inputClass}
                />
              </div>

              <div className="lg:col-span-2">
                <label className={labelClass}>Note</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Stock opname gudang"
                  value={stokForm.note}
                  onChange={(e) =>
                    setStokForm((p) => ({ ...p, note: e.target.value }))
                  }
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className={primaryBtn}
                disabled={isSavingStock}
                onClick={submitTambahStock}
              >
                <span className="inline-flex items-center gap-2">
                  {isSavingStock ? "Menyimpan..." : "Simpan"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
