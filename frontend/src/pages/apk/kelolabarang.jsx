// apk/kelolabarang.jsx
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import axios from "../../lib/axios";

/* =========================
  CATEGORY LABEL HELPERS (GLOBAL SCOPE)
  supaya bisa dipakai di KelolaBarang & komponen lain
========================= */
const CATEGORY_LABELS = {
  apk: "APK",
  bahan_kampanye: "Bahan Kampanye",
};

const formatCategoryLabel = (c) => {
  if (!c) return "";
  return (
    CATEGORY_LABELS[c] ||
    String(c)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (m) => m.toUpperCase())
  );
};

/**
 * ✅ Searchable dropdown (search ada DI DALAM dropdown)
 */
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const kw = q.toLowerCase().trim();
    if (!kw) return options;
    return options.filter((o) => (o.label || "").toLowerCase().includes(kw));
  }, [options, q]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest?.("[data-searchable-select]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" data-searchable-select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={`w-full text-left px-6 py-3 pr-12 border border-slate-300 rounded-lg bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"}`}
      >
        {selected?.label || placeholder}
        <Icon
          icon="mdi:chevron-down"
          width="22"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                width="20"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari item..."
                className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Tidak ada hasil.</div>
            ) : (
              filtered.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50
                    ${String(o.value) === String(value) ? "bg-blue-50" : ""}`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KelolaBarang() {
  const navigate = useNavigate();

  // ✅ ganti kalau route index APK kamu beda
  const APK_INDEX_PATH = "/apk";

  const [activeTab, setActiveTab] = useState("bentuk"); // bentuk | item | stok

  /* =========================
    DATA (TAB ITEM)
  ========================= */
  const [bentuks, setBentuks] = useState([]);
  const [units, setUnits] = useState([]);
  const [loadingBentuks, setLoadingBentuks] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // filter bentuk berdasarkan category (TAB ITEM)
  const [selectedCategory, setSelectedCategory] = useState("");

  /* =========================
    DATA (TAB STOK)
  ========================= */
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // FILTER BERTINGKAT (TAB STOK): Category -> Bentuk + Search
  const [stokCategory, setStokCategory] = useState("");
  const [stokBentukId, setStokBentukId] = useState("");
  const [stokSearch, setStokSearch] = useState("");

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

      // ✅ redirect ke index apk
      navigate(APK_INDEX_PATH);
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
    stock: "",
    budget_total: "",
    budget_note: "",
    description: "",
    is_active: true,
  });
  const [isSavingItem, setIsSavingItem] = useState(false);

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
        stock: parseRibuanToNumber(itemForm.stock),
        budget_total: parseRibuanToNumber(itemForm.budget_total),
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
        stock: "",
        budget_total: "",
        budget_note: "",
        description: "",
        is_active: true,
      });

      // ✅ redirect ke index apk
      navigate(APK_INDEX_PATH);
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
    TAB 3: TAMBAH STOCK (IN)
  ========================= */
  const [stokForm, setStokForm] = useState({
    item_id: "",
    qty: "",
    total_cost: "",
    note: "",
  });
  const [isSavingStock, setIsSavingStock] = useState(false);

  const selectedItemStock = useMemo(() => {
    return (items || []).find((x) => String(x.id) === String(stokForm.item_id));
  }, [items, stokForm.item_id]);

  const submitTambahStock = async () => {
    if (!stokForm.item_id) return toast.error("Item wajib dipilih.");
    if (!stokForm.qty) return toast.error("Qty wajib diisi.");
    if (!stokForm.total_cost || parseRibuanToNumber(stokForm.total_cost) <= 0)
      return toast.error("Budget Total wajib diisi.");

    try {
      setIsSavingStock(true);

      const payload = {
        item_id: Number(stokForm.item_id),
        qty: parseRibuanToNumber(stokForm.qty),
        total_cost: parseRibuanToNumber(stokForm.total_cost),
        note: stokForm.note || "",
      };

      await axios.post("/apk/stock/in", payload);

      toast.success("Stock berhasil ditambahkan.");
      setStokForm({ item_id: "", qty: "", total_cost: "", note: "" });

      // reset filter stok
      setStokCategory("");
      setStokBentukId("");
      setStokSearch("");

      // refresh list items biar stok terbaru kebaca
      await fetchItems();

      // ✅ redirect ke index apk
      navigate(APK_INDEX_PATH);
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

  /* =========================
    OPTIONS & FILTERS (TAB ITEM)
  ========================= */
  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set((bentuks || []).map((b) => b.category))).filter(Boolean);
    if (!cats.length) return ["apk", "bahan_kampanye"];
    return cats;
  }, [bentuks]);

  const bentukOptionsFiltered = useMemo(() => {
    if (!selectedCategory) return [];
    return (bentuks || []).filter((b) => String(b.category) === String(selectedCategory));
  }, [bentuks, selectedCategory]);

  useEffect(() => {
    setItemForm((p) => ({ ...p, bentuk_id: "" }));
  }, [selectedCategory]);

  /* =========================
    FILTERS (TAB STOK)
  ========================= */
  const stokCategoryOptions = useMemo(() => {
    const cats = Array.from(
      new Set((items || []).map((it) => it?.bentuk?.category).filter(Boolean))
    );
    return cats;
  }, [items]);

  const stokBentukOptions = useMemo(() => {
    const list = (items || [])
      .filter((it) => (stokCategory ? it?.bentuk?.category === stokCategory : true))
      .map((it) => it?.bentuk)
      .filter(Boolean);

    const map = new Map();
    list.forEach((b) => {
      if (b?.id) map.set(String(b.id), b);
    });
    return Array.from(map.values());
  }, [items, stokCategory]);

  const filteredItems = useMemo(() => {
    const kw = (stokSearch || "").toLowerCase().trim();

    return (items || []).filter((it) => {
      const okCategory = stokCategory
        ? String(it?.bentuk?.category) === String(stokCategory)
        : true;

      const okBentuk = stokBentukId ? String(it?.bentuk_id) === String(stokBentukId) : true;

      const okSearch = kw
        ? `${it?.name || ""} ${it?.bentuk?.name || ""}`.toLowerCase().includes(kw)
        : true;

      return okCategory && okBentuk && okSearch;
    });
  }, [items, stokCategory, stokBentukId, stokSearch]);

  useEffect(() => {
    setStokBentukId("");
    setStokForm((p) => ({ ...p, item_id: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stokCategory]);

  useEffect(() => {
    setStokForm((p) => ({ ...p, item_id: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stokBentukId]);

  /* =========================
    UI HELPERS
  ========================= */
  const tabBtnBase =
    "flex-1 px-4 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 border";
  const tabBtnActive = "bg-blue-600 text-white border-blue-600 shadow-sm";
  const tabBtnIdle = "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";

  const cardClass = "bg-white rounded-xl border border-slate-200 overflow-hidden";
  const cardHeaderClass = "p-6 border-b border-slate-200 bg-slate-50";
  const cardBodyClass = "p-6";

  const labelClass = "block text-md font-medium text-slate-700 mb-1";
  const inputClass =
    "w-full appearance-none px-6 py-3 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const primaryBtn =
    "px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm";

  // ✅ (ADDED) format qty supaya 8080.000 -> 8080 (tanpa ngerusak angka lain)
  const formatQty = (v) => {
    if (v === null || v === undefined || v === "") return "-";
    const s = String(v);

    if (s.includes(".")) {
      return s
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, "");
    }
    return s;
  };

  // ✅ (ADDED) format angka ribuan untuk input (Indonesia)
  const formatRibuan = (val) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (!s) return "";
    const digits = s.replace(/[^\d]/g, "");
    if (!digits) return "";
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // ✅ (ADDED) parse dari string ber-koma ke number aman
  const parseRibuanToNumber = (val) => {
    if (val === null || val === undefined || val === "") return 0;
    const digits = String(val).replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  };

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
            <p className="text-slate-500 mt-1">Tambah bentuk, tambah item, dan tambah stock.</p>
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
            <p className="text-slate-500 mt-1">Tambah bentuk sesuai dengan kategori yang ada</p>
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
                    onChange={(e) => setBentukForm((p) => ({ ...p, category: e.target.value }))}
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
                  onChange={(e) => setBentukForm((p) => ({ ...p, name: e.target.value }))}
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
                {isSavingBentuk ? "Menyimpan..." : "Simpan"}
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
                    <option value="">{loadingBentuks ? "Loading..." : "Pilih Kategori"}</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {formatCategoryLabel(c)}
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
                    onChange={(e) => setItemForm((p) => ({ ...p, bentuk_id: e.target.value }))}
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
                  onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
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
                    onChange={(e) => setItemForm((p) => ({ ...p, unit_id: e.target.value }))}
                    className={inputClass}
                    disabled={loadingUnits}
                  >
                    <option value="">{loadingUnits ? "Loading..." : "Pilih Satuan"}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 50"
                  value={formatRibuan(itemForm.stock)}
                  onChange={(e) => setItemForm((p) => ({ ...p, stock: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Budget Total <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRibuan(itemForm.budget_total)}
                  placeholder="Contoh: 100.000"
                  onChange={(e) => setItemForm((p) => ({ ...p, budget_total: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="lg:col-span-2">
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Spanduk ukuran 2x1 meter"
                  value={itemForm.description}
                  onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value }))}
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
                {isSavingItem ? "Menyimpan..." : "Simpan"}
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
            <p className="text-slate-500 mt-1">Tambah item dan stok</p>
          </div>

          <div className={cardBodyClass}>
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <b>Info:</b> Filter Kategori &amp; Bentuk itu <b>opsional</b> — kamu bisa langsung
              pilih item tanpa filter.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  Filter Kategori <span className="text-slate-400">(opsional)</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={stokCategory}
                    onChange={(e) => setStokCategory(e.target.value)}
                    className={inputClass}
                    disabled={loadingItems}
                  >
                    <option value="">Semua Kategori</option>
                    {stokCategoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {formatCategoryLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Filter Bentuk <span className="text-slate-400">(opsional)</span>
                </label>
                <div className="relative">
                  <Icon
                    icon="mdi:chevron-down"
                    width="22"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <select
                    value={stokBentukId}
                    onChange={(e) => setStokBentukId(e.target.value)}
                    className={inputClass}
                    disabled={loadingItems}
                  >
                    <option value="">Semua Bentuk</option>
                    {stokBentukOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className={labelClass}>
                  Nama Item <span className="text-red-500">*</span>
                </label>

                <SearchableSelect
                  value={stokForm.item_id}
                  disabled={loadingItems}
                  placeholder={loadingItems ? "Loading..." : "Pilih Item"}
                  options={filteredItems.map((it) => ({
                    value: it.id,
                    label: `${it.name} (${it?.bentuk?.name || "-"})`,
                  }))}
                  onChange={(val) => setStokForm((p) => ({ ...p, item_id: String(val) }))}
                />

                {selectedItemStock && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm">
                      <div className="font-semibold text-slate-800">
                        {selectedItemStock.name} ({selectedItemStock?.bentuk?.name || "-"})
                      </div>
                      <div className="text-xs text-slate-500">
                        Stok sekarang: <b>{formatQty(selectedItemStock?.stock?.qty_current)}</b>{" "}
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
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 50"
                  value={formatRibuan(stokForm.qty)}
                  onChange={(e) => setStokForm((p) => ({ ...p, qty: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Budget Total <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Contoh: 15.000"
                  value={formatRibuan(stokForm.total_cost)}
                  onChange={(e) => setStokForm((p) => ({ ...p, total_cost: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="lg:col-span-2">
                <label className={labelClass}>Note</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Stock opname gudang"
                  value={stokForm.note}
                  onChange={(e) => setStokForm((p) => ({ ...p, note: e.target.value }))}
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
                {isSavingStock ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
