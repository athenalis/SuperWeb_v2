import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import axios from "../../lib/axios";
import { createPortal } from "react-dom";

/* =========================
   HELPERSh
========================= */
const isPlatformX = (platformName) => platformName?.toLowerCase() === "x";
const isStoryContent = (contentTypeName) => contentTypeName?.toLowerCase() === "story";

/* ===== FOLLOWERS HELPERS ===== */
const MAX_FOLLOWERS = 999_999_999;

const formatFollowersInput = (value) => {
  if (!value) return "";
  const number = Number(value);
  if (isNaN(number)) return "";

  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseFollowersInput = (value, prevValue = "") => {
  const raw = value.replace(/\D/g, "");
  if (!raw) return "";

  const num = Number(raw);
  if (num > MAX_FOLLOWERS) return prevValue;

  return raw;
};

const MAX_BUDGET = 999_999_999_999;

const formatRupiahInput = (value) => {
  if (!value) return "";
  const number = Number(value);
  if (isNaN(number)) return "";

  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseRupiahInput = (value, prevValue = "") => {
  const raw = value.replace(/\D/g, "");
  if (!raw) return "";

  const num = Number(raw);
  if (num > MAX_BUDGET) return prevValue;

  return raw;
};

const formatCPLabel = (type) => {
  if (type === "phone") return "No. Telepon";
  if (type === "email") return "Email";
  return "Kontak";
};

const intersectPlatforms = (selected, influencerPlatforms) => {
  const set = new Set(selected.map(Number));
  return influencerPlatforms.filter((p) => set.has(Number(p.id)));
};

const makeInfluencerRow = () => ({
  rowId: `row_${Math.random().toString(16).slice(2)}`,
  influencer_id: "",
});

export function formatFollowers(num) {
  if (!num) return "-";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(".0", "") + " jt";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(".0", "") + " rb";
  return num.toString();
}

/* =========================
   ICON MASTER (match Edit)
========================= */
const PLATFORM_ICON = {
  Instagram: { icon: "skill-icons:instagram" },
  TikTok: { icon: "logos:tiktok-icon" },
  YouTube: { icon: "logos:youtube-icon" },
  Facebook: { icon: "logos:facebook" },
  X: { icon: "ri:twitter-x-line" },
  "X (Twitter)": { icon: "ri:twitter-x-line" },
  Twitter: { icon: "ri:twitter-x-line" },
};

/* =========================
   MAIN
========================= */
export default function CreateContent() {
  const navigate = useNavigate();

  // refs
  const dropdownPortalRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownBtnRef = useRef(null);

  // data
  const [platforms, setPlatforms] = useState([]);
  const [contentTypesByPlatform, setContentTypesByPlatform] = useState({});
  const [influencers, setInfluencers] = useState([]);

  // ui
  const [loading, setLoading] = useState(false);
  const [openPlatform, setOpenPlatform] = useState(false);
  const [showAddInfluencer, setShowAddInfluencer] = useState(false);
  const [adsErrors, setAdsErrors] = useState({});

  // exclusive accordion like Edit
  const [openContentAccordion, setOpenContentAccordion] = useState({});
  const [openAdsAccordion, setOpenAdsAccordion] = useState({});

  // add influencer modal
  const [savingInfluencer, setSavingInfluencer] = useState(false);
  const [newInfluencer, setNewInfluencer] = useState({
    name: "",
    email: "",
    contacts: [],
    platforms: [],
  });

  // platform dropdown (portal) positioning
  const [platformDropdownPos, setPlatformDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const [form, setForm] = useState({
    title: "",
    posting_date: "",
    platform_ids: [],
    use_influencer: false,
    influencer_rows: [makeInfluencerRow()],
    selected_content_by_platform: {},
    budget_content: "",
    is_ads: false,
    ads_by_platform: {},
    description: "",
  });

  /* =========================
     FETCH: PLATFORMS
  ========================= */
  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const res = await axios.get("/platforms");
        setPlatforms(res.data);
      } catch (err) {
        console.error("Gagal ambil platforms:", err);
        toast.error("Gagal mengambil daftar platform");
      }
    };
    fetchPlatforms();
  }, []);

  /* =========================
     FETCH: CONTENT TYPES
  ========================= */
  useEffect(() => {
    const fetchContentTypes = async () => {
      try {
        const res = await axios.get("/content-types");
        setContentTypesByPlatform(res.data);
      } catch (err) {
        console.error("Gagal ambil content types:", err);
        toast.error("Gagal mengambil jenis konten");
      }
    };
    fetchContentTypes();
  }, []);

  /* =========================
     FETCH: INFLUENCERS (by platform)
  ========================= */
  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        const params = form.platform_ids.length ? { platform_ids: form.platform_ids } : {};
        const res = await axios.get("/influencers/all", { params });
        setInfluencers(Array.isArray(res.data.data) ? res.data.data : res.data);
      } catch (err) {
        console.error("Gagal ambil influencer:", err);
        toast.error("Gagal mengambil daftar influencer");
      }
    };

    if (form.platform_ids.length) fetchInfluencers();
  }, [form.platform_ids]);

  /* =========================
     OUTSIDE CLICK: close dropdown
  ========================= */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownBtnRef.current?.contains(e.target) ||
        dropdownPortalRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpenPlatform(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* =========================
     POS: platform dropdown (portal)
  ========================= */
  useEffect(() => {
    if (!openPlatform) return;

    const calc = () => {
      const btn = dropdownBtnRef.current;
      if (!btn) return;

      const r = btn.getBoundingClientRect();
      const dropdownHeight = 200;
      const spaceBelow = window.innerHeight - r.bottom;

      const top =
        spaceBelow < dropdownHeight
          ? r.top - dropdownHeight - 8
          : r.bottom + 8;

      setPlatformDropdownPos({
        top,
        left: r.left,
        width: r.width,
      });
    };

    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, true);
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc, true);
    };
  }, [openPlatform]);

  /* =========================
     DERIVED
  ========================= */
  const selectedPlatforms = useMemo(() => form.platform_ids.map(Number), [form.platform_ids]);

  const showInfluencerSection = useMemo(() => {
    return form.use_influencer && selectedPlatforms.length > 0;
  }, [form.use_influencer, selectedPlatforms]);

  const availableInfluencers = useMemo(() => {
    if (!selectedPlatforms.length) return influencers;
    return influencers.filter(
      (inf) =>
        Array.isArray(inf.platforms) &&
        inf.platforms.some((p) => selectedPlatforms.includes(Number(p.id)))
    );
  }, [selectedPlatforms, influencers]);

  const totalAdsBudget = useMemo(() => {
    return Object.values(form.ads_by_platform || {}).reduce(
      (sum, ad) => sum + Number(ad?.budget_ads || 0),
      0
    );
  }, [form.ads_by_platform]);

  /* =========================
     HANDLERS
  ========================= */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlatformToggle = (platformId, checked) => {
    setForm((prev) => {
      const nextIds = checked
        ? [...prev.platform_ids, platformId]
        : prev.platform_ids.filter((id) => id !== platformId);
      return { ...prev, platform_ids: nextIds };
    });
  };

  const addInfluencerRow = () => {
    setForm((prev) => ({
      ...prev,
      influencer_rows: [...prev.influencer_rows, makeInfluencerRow()],
    }));
  };

  const removeInfluencerRow = (rowId) => {
    setForm((prev) => {
      const next = prev.influencer_rows.filter((r) => r.rowId !== rowId);
      return { ...prev, influencer_rows: next.length ? next : [makeInfluencerRow()] };
    });
  };

  const setInfluencerInRow = (rowId, influencerId) => {
    setForm((prev) => ({
      ...prev,
      influencer_rows: prev.influencer_rows.map((r) =>
        r.rowId === rowId ? { ...r, influencer_id: influencerId } : r
      ),
    }));
  };

  const handleContentPick = (platformId, contentType, checked) => {
    setForm((prev) => {
      const prevPlatformContent = prev.selected_content_by_platform?.[platformId] || {};

      // UNCHECK -> hapus
      if (!checked) {
        const nextPlatformContent = { ...prevPlatformContent };
        delete nextPlatformContent[contentType.id];

        return {
          ...prev,
          selected_content_by_platform: {
            ...prev.selected_content_by_platform,
            [platformId]: Object.keys(nextPlatformContent).length > 0 ? nextPlatformContent : undefined,
          },
        };
      }

      // CHECK -> tambah
      return {
        ...prev,
        selected_content_by_platform: {
          ...prev.selected_content_by_platform,
          [platformId]: {
            ...prevPlatformContent,
            [contentType.id]: {
              is_collaborator: false,
              link: "",
            },
          },
        },
      };
    });
  };

  const handleAdsChange = (platformId, field, value) => {
    setForm((prev) => {
      const nextAds = {
        ...prev.ads_by_platform,
        [platformId]: {
          ...(prev.ads_by_platform?.[platformId] || {}),
          [field]: value,
        },
      };

      // VALIDASI REAL-TIME
      const start = nextAds[platformId]?.start_date;
      const end = nextAds[platformId]?.end_date;
      const postingDate = prev.posting_date;

      setAdsErrors((prevErr) => {
        const nextErr = { ...prevErr };

        if (start && postingDate && start < postingDate) {
          nextErr[platformId] = "Start Ads tidak boleh kurang dari tanggal posting";
          toast.error("Start Ads tidak boleh kurang dari tanggal posting");
        } else if (start && end && end < start) {
          nextErr[platformId] = "Tanggal selesai ads harus sama atau setelah tanggal mulai";
        } else {
          delete nextErr[platformId];
        }

        return nextErr;
      });

      return { ...prev, ads_by_platform: nextAds };
    });
  };

  const getPlatformLabel = (ids) => {
    if (!ids || !ids.length) return "Pilih platform";

    const names = ids
      .map((id) => platforms.find((p) => Number(p.id) === Number(id))?.name)
      .filter(Boolean);

    if (!names.length) return "Platform";

    return names.join(", ");
  };

  const getPlatformName = (id) => platforms.find((p) => Number(p.id) === Number(id))?.name || id;

  /* =========================
     VALIDATION (KEEP LOGIC)
  ========================= */
  const validate = () => {
    if (!form.title.trim()) return "Judul konten wajib diisi";
    if (!form.posting_date) return "Tanggal konten wajib diisi";
    if (!form.budget_content) return "Budget konten wajib diisi";
    if (Number(form.budget_content) <= 0) return "Budget konten harus lebih dari 0";
    if (!selectedPlatforms.length) return "Mohon pilih setidaknya satu platform";

    for (const pid of selectedPlatforms) {
      const picked = form.selected_content_by_platform?.[pid];
      if (!picked || Object.keys(picked).length === 0) {
        return `Mohon pilih setidaknya satu jenis konten untuk platform ${getPlatformName(pid)}`;
      }
    }

    if (form.is_ads) {
      const ads = form.ads_by_platform || {};
      let hasAnyAdsFilled = false;

      for (const pid of selectedPlatforms) {
        const a = ads[pid];
        if (!a) continue;

        const filledFields = [a.start_date, a.end_date, a.budget_ads].filter(Boolean);

        // kalau salah satu diisi -> wajib lengkap
        if (filledFields.length > 0) {
          hasAnyAdsFilled = true;

          if (!a.start_date) return `Tanggal mulai ads wajib diisi untuk ${getPlatformName(pid)}`;
          if (!a.end_date) return `Tanggal selesai ads wajib diisi untuk ${getPlatformName(pid)}`;
          if (!a.budget_ads) return `Budget ads wajib diisi untuk ${getPlatformName(pid)}`;
          if (Number(a.budget_ads) <= 0) return `Budget ads harus lebih dari 0 untuk ${getPlatformName(pid)}`;
        }
      }

      // optional: checkbox dicentang tapi ga ada yg diisi -> boleh
      if (!hasAnyAdsFilled) {
        // no-op
      }
    }

    if (form.use_influencer) {
      const pickedRows = form.influencer_rows.filter((r) => r.influencer_id);

      if (pickedRows.length === 0) {
        return "Silakan pilih setidaknya satu influencer, atau nonaktifkan opsi Gunakan Influencer";
      }

      for (const row of pickedRows) {
        const inf = influencers.find((i) => i.id === row.influencer_id);
        if (!inf) continue;

        const hasEmail = !!inf.email;
        const hasPhone = Array.isArray(inf.contacts) && inf.contacts.length > 0;

        if (!hasEmail && !hasPhone) {
          return `Influencer \"${inf.name}\" belum memiliki kontak person (email atau nomor telepon)`;
        }
      }
    }

    return "";
  };

  /* =========================
     SUBMIT (KEEP LOGIC)
  ========================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = validate();
    if (err) return toast.error(err);

    // VALIDASI ADS sebelum submit
    if (form.is_ads) {
      for (const pid of selectedPlatforms) {
        const a = form.ads_by_platform?.[pid];
        if (!a) continue;

        if (a.start_date && form.posting_date && a.start_date < form.posting_date) {
          return toast.error(`Start Ads untuk ${getPlatformName(pid)} tidak boleh kurang dari tanggal konten`);
        }
        if (a.start_date && a.end_date && a.end_date < a.start_date) {
          return toast.error(`End Ads untuk ${getPlatformName(pid)} harus setelah start ads`);
        }
        if ((a.start_date || a.end_date || a.budget_ads) && (!a.start_date || !a.end_date || !a.budget_ads)) {
          return toast.error(`Lengkapi semua field ads untuk ${getPlatformName(pid)}`);
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        title: form.title,
        posting_date: form.posting_date,
        content_types: form.selected_content_by_platform,
        budget_content: Number(form.budget_content),
        description: form.description,
        influencer_ids: form.use_influencer
          ? form.influencer_rows.filter((r) => r.influencer_id).map((r) => r.influencer_id)
          : [],
        is_ads: form.is_ads,
        ads_by_platform: form.is_ads ? form.ads_by_platform : {},
      };

      await axios.post("/content-plans", payload);
      toast.success("Content plan berhasil dibuat!");
      navigate("/content");
    } catch (e2) {
      console.error(e2);
      toast.error("Gagal membuat content plan");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI CLASSES
     - smallest text = 16px (Tailwind text-base)
  ========================= */
  const baseInput =
    "w-full border rounded-lg px-6 py-3 bg-white text-base focus:ring-2 focus:ring-blue-500 focus:outline-none";
  const baseSelect =
    "w-full appearance-none border rounded-lg px-6 py-3 pr-12 bg-white text-base focus:ring-2 focus:ring-blue-500 focus:outline-none";
  const disabledSelect = "bg-slate-100 cursor-not-allowed";

  return (
    <div className="p-8 max-w-8xl mx-auto text-base">
      <h2 className="text-4xl text-blue-900 font-bold mb-10 text-center">Form Perencanaan Konten</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* ================= LEFT CARD: INFORMASI ================= */}
          <div className="bg-white border border-blue-300 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="mdi:information-outline" width={22} className="text-blue-900" />
              <h3 className="text-xl font-extrabold text-slate-900">Informasi Konten</h3>
            </div>
            <p className="text-base text-slate-500 mb-6">Lengkapi informasi dasar sebelum memilih platform & konten.</p>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1) JUDUL */}
                <Field label={<span className="text-lg font-bold">Judul Konten</span>} required>
                  <input
                    className={baseInput}
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Masukkan judul konten"
                  />
                </Field>

                {/* 2) TANGGAL */}
                <Field label={<span className="text-lg font-bold">Tanggal Konten</span>} required>
                  <input
                    type="date"
                    className={baseInput}
                    name="posting_date"
                    value={form.posting_date}
                    onChange={handleChange}
                  />
                </Field>
              </div>

              {/* 3) BUDGET KONTEN */}
              <Field label="Budget Konten" required>
                <input
                  type="text"
                  inputMode="numeric"
                  className={baseInput}
                  name="budget_content"
                  value={formatRupiahInput(form.budget_content)}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      budget_content: parseRupiahInput(e.target.value, prev.budget_content),
                    }));
                  }}
                  placeholder="Masukkan budget konten"
                />
              </Field>

              {/* DESKRIPSI */}
              <Field label="Deskripsi">
                <textarea
                  name="description"
                  rows={4}
                  className={baseInput}
                  placeholder="Masukkan deskripsi (opsional)"
                  value={form.description}
                  onChange={handleChange}
                />
              </Field>

              {/* 4) PLATFORM (DROPDOWN CHECKBOX) */}
              <Field label={<span className="text-lg font-bold">Platform / Sosial media</span>} required>
                <div className="relative" ref={dropdownRef}>
                  <button
                    ref={dropdownBtnRef}
                    type="button"
                    onClick={() => setOpenPlatform((s) => !s)}
                    className={`${baseSelect} text-left relative`}
                  >
                    <span className={form.platform_ids.length ? "text-slate-800" : "text-slate-400"}>
                      {getPlatformLabel(form.platform_ids)}
                    </span>

                    <Icon
                      icon="mdi:chevron-down"
                      width={22}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </button>

                  {/* Dropdown via Portal (fix clipping/overlay issues) */}
                  {openPlatform &&
                    createPortal(
                      <div
                        ref={dropdownPortalRef}
                        className="fixed z-[9999] bg-white border-2 rounded-xl shadow-xl p-4 space-y-3"
                        style={{
                          top: platformDropdownPos.top,
                          left: platformDropdownPos.left,
                          width: platformDropdownPos.width,
                        }}
                      >
                        {platforms.map((p) => {
                          const pIcon = PLATFORM_ICON[p.name];
                          return (
                            <label key={p.id} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={form.platform_ids.includes(p.id)}
                                onChange={(e) => handlePlatformToggle(p.id, e.target.checked)}
                              />
                              {pIcon && <Icon icon={pIcon.icon} width={20} className="shrink-0" />}
                              <span className="text-base">{p.name}</span>
                            </label>
                          );
                        })}
                      </div>,
                      document.body
                    )}
                </div>

                {selectedPlatforms.length > 0 && (
                  <div className="mt-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.use_influencer}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm((prev) => ({
                            ...prev,
                            use_influencer: checked,
                            influencer_rows: checked ? prev.influencer_rows : [makeInfluencerRow()],
                          }));
                        }}
                        className="scale-125"
                      />
                      <span className="font-bold text-slate-800">Gunakan Influencer</span>
                      <span className="text-base text-slate-500">(opsional, pilih konten dulu)</span>
                    </label>

                    {showInfluencerSection && (
                      <div className="mt-4 rounded-xl bg-white border border-slate-200 shadow-sm p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-800">Influencer</div>
                            <div className="text-base text-slate-500">Pilih influencer sesuai platform yang kamu pilih</div>
                          </div>

                          <button
                            type="button"
                            onClick={addInfluencerRow}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white transition"
                          >
                            <Icon icon="mdi:plus" width={20} />
                            <span className="text-base font-bold">Tambah</span>
                          </button>
                        </div>

                        {/* Scrollable influencer list (match Edit feeling) */}
                        <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1">
                          {form.influencer_rows.map((row, idx) => {
                            const selectedInf = influencers.find((x) => x.id === row.influencer_id);

                            const alreadyPicked = new Set(
                              form.influencer_rows
                                .filter((r) => r.rowId !== row.rowId)
                                .map((r) => r.influencer_id)
                                .filter(Boolean)
                            );

                            const optionsForThisRow = availableInfluencers.filter(
                              (inf) => !alreadyPicked.has(inf.id) || inf.id === row.influencer_id
                            );

                            const relevantPlatforms = selectedInf
                              ? intersectPlatforms(selectedPlatforms, selectedInf.platforms)
                              : [];

                            return (
                              <div key={row.rowId} className="bg-white border rounded-xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="text-base font-bold text-slate-700 mb-2">Influencer {idx + 1}</div>

                                    <div className="flex gap-2 items-center">
                                      <div className="relative flex-1">
                                        <select
                                          value={row.influencer_id}
                                          onChange={(e) =>
                                            setInfluencerInRow(row.rowId, Number(e.target.value))
                                          }
                                          className={`${baseSelect} ${optionsForThisRow.length ? "" : disabledSelect}`}
                                          disabled={optionsForThisRow.length === 0}
                                        >
                                          <option value="" disabled>
                                            {optionsForThisRow.length
                                              ? "Pilih Influencer"
                                              : "Tidak ada influencer untuk platform ini"}
                                          </option>
                                          {optionsForThisRow.map((inf) => (
                                            <option key={inf.id} value={inf.id}>
                                              {inf.name}
                                            </option>
                                          ))}
                                        </select>

                                        <Icon
                                          icon="mdi:chevron-down"
                                          width={22}
                                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => setShowAddInfluencer(true)}
                                        className="w-12 h-12 rounded-lg border border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white flex items-center justify-center transition"
                                        title="Tambah Influencer Baru"
                                      >
                                        <Icon icon="mdi:plus" width={22} />
                                      </button>
                                    </div>

                                    {selectedInf && (
                                      <div className="mt-3 space-y-4">
                                        <div className="text-base font-bold text-slate-800">{selectedInf.name}</div>

                                        {/* Platforms */}
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {(selectedInf.platforms || []).map((p) => {
                                            const name = p.name || p.platform?.name;
                                            const icon = PLATFORM_ICON[name];
                                            return (
                                              <div
                                                key={p.id ?? `${selectedInf.id}_${p.username}_${name}`}
                                                className="flex items-center justify-between border rounded-lg px-4 py-3 min-h-[72px]"
                                              >
                                                <div className="flex flex-col min-w-0">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    {icon && <Icon icon={icon.icon} width={18} className="shrink-0" />}
                                                    <span className="text-base font-semibold text-slate-700 truncate">
                                                      {name || "-"}
                                                    </span>
                                                  </div>
                                                  <span className="text-base text-slate-500 truncate">
                                                    {p.username || "-"}
                                                  </span>
                                                </div>
                                                <div className="text-base font-bold text-slate-800">{formatFollowers(p.followers)}</div>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {/* Kontak Person */}
                                        {(selectedInf.email ||
                                          (selectedInf.contacts && selectedInf.contacts.length > 0)) && (
                                            <div className="mt-4 border-t pt-4">
                                              <div className="text-base font-bold text-slate-700 mb-2">CP (Kontak Person)</div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedInf.email && (
                                                  <div className="border rounded-lg px-4 py-3">
                                                    <div className="text-base font-semibold text-slate-500">Email</div>
                                                    <div className="text-base text-slate-800">{selectedInf.email}</div>
                                                  </div>
                                                )}

                                                {selectedInf.contacts &&
                                                  selectedInf.contacts.length > 0 &&
                                                  selectedInf.contacts.map((c) => (
                                                    <div
                                                      key={`cp_${selectedInf.id}_${c}`}
                                                      className="border rounded-lg px-4 py-3"
                                                    >
                                                      <div className="text-base font-semibold text-slate-500">No. Telepon</div>
                                                      <div className="text-base text-slate-800">{c}</div>
                                                    </div>
                                                  ))}
                                              </div>
                                            </div>
                                          )}

                                        {/* (Keep) Relevant platforms variable in case you use later */}
                                        {relevantPlatforms && relevantPlatforms.length === 0 ? null : null}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeInfluencerRow(row.rowId)}
                                    title="Hapus"
                                    className="w-10 h-10 flex items-center justify-center rounded-lg border text-slate-500 hover:text-red-600 hover:border-red-300 transition"
                                  >
                                    <Icon icon="mdi:trash-outline" width={20} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Field>
            </div>
          </div>

          {/* ================= RIGHT CARD: DETAIL ================= */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm xl:sticky xl:top-6 self-start">
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="mdi:form-select" width={22} className="text-blue-900" />
              <h3 className="text-xl font-extrabold text-slate-900">Detail Konten</h3>
            </div>
            <p className="text-base text-slate-500 mb-6">Pilih jenis konten per platform, atur ads (opsional), lalu simpan.</p>

            <div className="space-y-10">
              {/* KONTEN (ACCORDION PER PLATFORM) - Exclusive like Edit */}
              <Field label="Konten" required>
                {!selectedPlatforms.length ? (
                  <div className="text-slate-500 text-base">Pilih platform dulu untuk menampilkan pilihan konten.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-base text-slate-500">
                      Pilih <span className="font-semibold">jenis konten</span> untuk setiap platform.
                    </div>

                    {selectedPlatforms.map((pid) => {
                      const platform = platforms.find((p) => Number(p.id) === Number(pid));
                      const types = contentTypesByPlatform[String(pid)] || [];
                      const pIcon = PLATFORM_ICON[platform?.name];

                      const pickedObj = form.selected_content_by_platform?.[pid] || null;
                      const pickedNames =
                        pickedObj && Object.keys(pickedObj).length > 0
                          ? Object.keys(pickedObj)
                            .map((id) => types.find((t) => Number(t.id) === Number(id))?.name)
                            .filter(Boolean)
                          : [];

                      const isOpen = !!openContentAccordion?.[pid];

                      return (
                        <div key={pid} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                          <button
                            type="button"
                            onClick={() => {
                              const isCurrentlyOpen = openContentAccordion?.[pid] ?? false;
                              setOpenContentAccordion(isCurrentlyOpen ? {} : { [pid]: true });
                            }}
                            className="w-full flex items-start justify-between gap-4 px-4 py-4"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              {pIcon && <Icon icon={pIcon.icon} width={20} className="shrink-0" />}
                              <div className="font-bold text-slate-800">{platform?.name || getPlatformName(pid)}</div>
                              <span className="text-base text-slate-500 ml-2 truncate">
                                {pickedNames.length ? `(${pickedNames.join(", ")})` : "(Belum dipilih)"}
                              </span>
                            </div>

                            <Icon
                              icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                              width={22}
                              className="text-slate-500 mt-1 shrink-0"
                            />
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4">
                              <div className="flex flex-wrap gap-4">
                                {types.map((t) => {
                                  const platformName = platform?.name || getPlatformName(pid);
                                  const isStory = isStoryContent(t.name);
                                  const isX = isPlatformX(platformName);
                                  const canUseCollaborator = !isStory && !isX;
                                  const selected = form.selected_content_by_platform?.[pid]?.[t.id];

                                  return (
                                    <div
                                      key={`${pid}_${t.id}`}
                                      className={`flex-1 min-w-[180px] min-h-[120px] border rounded-lg p-4 space-y-3
                                        ${selected ? "border-blue-600 bg-blue-50" : "border-slate-200"}
                                      `}
                                    >
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={!!selected}
                                          onChange={(e) => handleContentPick(pid, t, e.target.checked)}
                                          className="scale-125"
                                        />
                                        {pIcon && <Icon icon={pIcon.icon} width={18} className="shrink-0" />}
                                        <span className="font-medium text-base">{t.name}</span>
                                      </label>

                                      {selected && (
                                        <div className="pl-7 space-y-2 text-base">
                                          {canUseCollaborator && (
                                            <label className="flex items-center gap-2 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={selected.is_collaborator}
                                                onChange={(e) => {
                                                  setForm((prev) => ({
                                                    ...prev,
                                                    selected_content_by_platform: {
                                                      ...prev.selected_content_by_platform,
                                                      [pid]: {
                                                        ...prev.selected_content_by_platform[pid],
                                                        [t.id]: {
                                                          ...prev.selected_content_by_platform[pid][t.id],
                                                          is_collaborator: e.target.checked,
                                                        },
                                                      },
                                                    },
                                                  }));
                                                }}
                                              />
                                              <span className="text-base">Aktifkan collaborator</span>
                                            </label>
                                          )}

                                          {isStory && (
                                            <div className="text-base text-red-500">
                                              Konten tipe Story tidak dapat menggunakan collaborator
                                            </div>
                                          )}

                                          {isX && (
                                            <div className="text-base text-red-500">Tidak dapat mengaktifkan collaborator di X</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {types.length === 0 && (
                                <div className="mt-3 text-base text-slate-500">Tidak ada konten untuk platform ini.</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Field>

              {/* ADS (opsional) - accordion (Exclusive like Edit) */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_ads"
                  checked={form.is_ads}
                  onChange={handleChange}
                  className="scale-125"
                />
                <span className="font-bold text-slate-800">Aktifkan Ads</span>
                <span className="text-base text-slate-500">(opsional)</span>
              </label>

              {form.is_ads &&
                selectedPlatforms.map((pid) => {
                  const platform = platforms.find((p) => Number(p.id) === Number(pid));
                  const pIcon = PLATFORM_ICON[platform?.name];
                  const isOpen = !!openAdsAccordion[pid];

                  return (
                    <div key={pid} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          const isCurrentlyOpen = !!openAdsAccordion[pid];
                          setOpenAdsAccordion(isCurrentlyOpen ? {} : { [pid]: true });
                        }}
                        className="w-full flex items-center justify-between px-4 py-4"
                      >
                        <div className="flex items-center gap-2">
                          {pIcon && <Icon icon={pIcon.icon} width={20} className="shrink-0" />}
                          <div className="font-bold text-slate-800">Ads – {platform?.name || getPlatformName(pid)}</div>
                        </div>
                        <Icon
                          icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                          width={22}
                          className="text-slate-500"
                        />
                      </button>

                      {isOpen && (
                        <div className="p-4 pt-0 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field label="Tanggal Mulai Ads">
                              <input
                                type="date"
                                className={baseInput}
                                value={form.ads_by_platform?.[pid]?.start_date || ""}
                                onChange={(e) => handleAdsChange(pid, "start_date", e.target.value)}
                                min={form.posting_date || ""}
                              />
                            </Field>

                            <Field label="Tanggal Selesai Ads">
                              <input
                                type="date"
                                className={baseInput}
                                value={form.ads_by_platform?.[pid]?.end_date || ""}
                                onChange={(e) => handleAdsChange(pid, "end_date", e.target.value)}
                                min={form.ads_by_platform?.[pid]?.start_date || form.posting_date || ""}
                              />
                            </Field>

                            <Field label="Budget Ads">
                              <input
                                type="number"
                                className={baseInput}
                                placeholder="Masukkan budget ads"
                                value={form.ads_by_platform?.[pid]?.budget_ads || ""}
                                onChange={(e) => handleAdsChange(pid, "budget_ads", e.target.value)}
                              />
                            </Field>
                          </div>

                          {adsErrors?.[pid] && (
                            <div className="text-base text-red-600 font-semibold">{adsErrors[pid]}</div>
                          )}

                          <div className="text-base text-slate-500">Kosongkan jika tidak ingin menggunakan ads di platform ini</div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* TOTAL BUDGET (match Edit) */}
              <div className="border rounded-xl p-4 bg-slate-50">
                <div className="text-base text-slate-500 mb-1">Total Budget</div>
                <div className="text-xl font-bold text-slate-800">
                  Rp {(Number(form.budget_content || 0) + totalAdsBudget).toLocaleString("id-ID")}
                </div>
              </div>

              {/* ACTION */}
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded-lg"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/content")}
                  className="text-slate-600 hover:underline"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* ================= MODAL TAMBAH INFLUENCER (KEEP LOGIC) ================= */}
      {showAddInfluencer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* HEADER */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-800">
                  Tambah Influencer Baru
                </h3>
                <p className="text-slate-500 mt-1">
                  Lengkapi data influencer dan pilih platform yang relevan
                </p>
              </div>
              <button
                onClick={() => setShowAddInfluencer(false)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-red-500 transition"
              >
                <Icon icon="mdi:close" width={24} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[380px_1fr]">
              {/* KOLOM KIRI: INFO PERSONAL */}
              <div className="bg-slate-50 p-8 overflow-y-auto space-y-6 border-r border-slate-200">
                <div className="flex items-center gap-2 mb-2 text-blue-900 font-bold uppercase tracking-wider text-xs">
                  <Icon icon="mdi:account-box" width={16} />
                  Informasi Dasar
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={`${baseInput} bg-slate-50`}
                      value={newInfluencer.name}
                      onChange={(e) => setNewInfluencer((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Contoh: Anya Geraldin"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(opsional)</span></label>
                    <input
                      className={`${baseInput} bg-slate-50`}
                      value={newInfluencer.email}
                      onChange={(e) => setNewInfluencer((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@domain.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">WhatsApp / Telepon <span className="text-slate-400 font-normal">(opsional)</span></label>
                    <input
                      className={`${baseInput} bg-slate-50`}
                      placeholder="08123456789"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setNewInfluencer((p) => ({ ...p, contacts: raw ? [raw] : [] }));
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                      <Icon icon="mdi:information-outline" width={16} />
                      Wajib isi salah satu kontak (Email / Telepon)
                    </p>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN: PLATFORMS */}
              <div className="flex flex-col h-full bg-white overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 bg-white z-10">
                  <div className="flex items-center gap-2 text-blue-900 font-bold uppercase tracking-wider text-xs mb-1">
                    <Icon icon="mdi:share-variant" width={16} />
                    Hubungkan Platform
                  </div>
                  <h4 className="font-bold text-lg text-slate-800">
                    Pilih Platform Influencer <span className="text-red-500">*</span>
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {platforms
                      .filter((p) => ["TikTok", "YouTube", "X", "Facebook", "Instagram"].includes(p.name))
                      .map((p) => {
                        const selected = newInfluencer.platforms.find((x) => x.platform_id === p.id);
                        const pIcon = PLATFORM_ICON[p.name];

                        return (
                          <div
                            key={p.id}
                            className={`
                              relative border-2 rounded-2xl p-4 transition-all duration-200 group cursor-pointer
                              ${selected
                                ? "border-blue-500 bg-blue-50/50 shadow-md ring-2 ring-blue-500/10"
                                : "border-white bg-white hover:border-blue-200 shadow-sm hover:shadow-md"
                              }
                            `}
                          >
                            <label className="flex items-center gap-3 font-bold text-base cursor-pointer mb-3 select-none">
                              <div className={`
                                w-5 h-5 rounded border flex items-center justify-center transition
                                ${selected ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 bg-white"}
                              `}>
                                {selected && <Icon icon="mdi:check" width={14} />}
                              </div>

                              <input
                                type="checkbox"
                                className="hidden"
                                checked={!!selected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (newInfluencer.platforms.length >= 5) {
                                      return toast.error("Maksimal 5 platform");
                                    }
                                    setNewInfluencer((prev) => ({
                                      ...prev,
                                      platforms: [
                                        ...prev.platforms,
                                        {
                                          platform_id: p.id,
                                          username: "",
                                          followers: "",
                                        },
                                      ],
                                    }));
                                  } else {
                                    setNewInfluencer((prev) => ({
                                      ...prev,
                                      platforms: prev.platforms.filter((x) => x.platform_id !== p.id),
                                    }));
                                  }
                                }}
                              />

                              <div className={`p-1.5 rounded-lg ${selected ? "bg-white shadow-sm" : "bg-slate-100"}`}>
                                {pIcon && <Icon icon={pIcon.icon} width={20} className={selected ? "text-blue-600" : "text-slate-500"} />}
                              </div>
                              <span className={selected ? "text-blue-900" : "text-slate-700"}>{p.name}</span>
                            </label>

                            {selected && (
                              <div className="space-y-3 pl-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                                    <input
                                      className="w-full border border-blue-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                      placeholder="username"
                                      value={selected.username}
                                      onChange={(e) => {
                                        setNewInfluencer((prev) => ({
                                          ...prev,
                                          platforms: prev.platforms.map((x) =>
                                            x.platform_id === p.id ? { ...x, username: e.target.value } : x
                                          ),
                                        }));
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Followers</label>
                                  <input
                                    type="text"
                                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="0"
                                    value={formatFollowersInput(selected.followers)}
                                    onChange={(e) => {
                                      setNewInfluencer((prev) => ({
                                        ...prev,
                                        platforms: prev.platforms.map((x) =>
                                          x.platform_id === p.id
                                            ? {
                                              ...x,
                                              followers: parseFollowersInput(e.target.value, x.followers),
                                            }
                                            : x
                                        ),
                                      }));
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 z-10">
                  <button
                    type="button"
                    onClick={() => setShowAddInfluencer(false)}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-800 transition"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    disabled={savingInfluencer}
                    onClick={async () => {
                      if (!newInfluencer.name.trim()) {
                        return toast.error("Nama influencer wajib diisi");
                      }

                      const hasEmail = !!newInfluencer.email;
                      const hasPhone = newInfluencer.contacts.length > 0;

                      if (!hasEmail && !hasPhone) {
                        return toast.error("Wajib isi minimal satu kontak (Email atau Telepon)");
                      }

                      if (newInfluencer.platforms.length === 0) {
                        return toast.error("Pilih minimal satu platform");
                      }

                      try {
                        setSavingInfluencer(true);

                        await axios.post("/influencers", {
                          name: newInfluencer.name,
                          email: newInfluencer.email || null,
                          contacts: newInfluencer.contacts || null,
                          platforms: newInfluencer.platforms,
                        });

                        toast.success("Influencer berhasil ditambahkan!");

                        setShowAddInfluencer(false);
                        setNewInfluencer({
                          name: "",
                          email: "",
                          contacts: [],
                          platforms: [],
                        });

                        // REFRESH DATA (ALL)
                        const res = await axios.get("/influencers/all", {
                          params: form.platform_ids.length ? { platform_ids: form.platform_ids } : {},
                        });
                        setInfluencers(
                          Array.isArray(res.data.data) ? res.data.data : res.data
                        );
                      } catch (e) {
                        console.error(e);
                        toast.error("Gagal menambahkan influencer");
                      } finally {
                        setSavingInfluencer(false);
                      }
                    }}
                    className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition active:scale-95 flex items-center gap-2"
                  >
                    {savingInfluencer && <Icon icon="mdi:loading" className="animate-spin" />}
                    {savingInfluencer ? "Menyimpan..." : "Simpan Influencer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   FIELD
========================= */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block mb-3 font-bold text-base">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
