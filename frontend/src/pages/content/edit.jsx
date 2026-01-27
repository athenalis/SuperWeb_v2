import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import api from "../../lib/axios";

/* =========================
   HELPERS
========================= */
const MAX_BUDGET = 999_999_999_999;

const formatRupiahInput = (value) => {
  if (!value) return "";
  const number = Number(value);
  if (isNaN(number)) return "";

  return number
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseRupiahInput = (value, prevValue = "") => {
  const raw = value.replace(/\D/g, "");
  if (!raw) return "";

  const num = Number(raw);

  if (num > MAX_BUDGET) {
    return prevValue;
  }

  return raw;
};

const makeInfluencerRow = () => ({
  rowId: `row_${Math.random().toString(16).slice(2)}`,
  influencer_id: "",
});

export function formatFollowers(num) {
  if (!num) return "-";
  if (num >= 1_000_000)
    return (num / 1_000_000).toFixed(1).replace(".0", "") + " jt";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(".0", "") + " rb";
  return num.toString();
}

/* =========================
   UI CONFIGURATION (from index.jsx)
========================= */
const STATUS_MASTER = [
  { label: "Terjadwal", icon: "solar:calendar-linear" },
  { label: "Sedang Dibuat", icon: "proicons:pencil" },
  { label: "Draf", icon: "proicons:document" },
  { label: "Diposting", icon: "meteor-icons:bullhorn" },
  { label: "Dibatalkan", icon: "gg:close-o" },
  { label: "Diblokir", icon: "mdi:block-helper" },
];

const statusStyle = {
  Diposting: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Terjadwal: "bg-blue-100 text-blue-700 border border-blue-200",
  Diblokir: "bg-slate-800 text-white shadow-sm",
  Dibatalkan: "bg-rose-100 text-rose-700 border border-rose-200",
  "Sedang Dibuat": "bg-amber-100 text-amber-800 border border-amber-200",
  Draf: "bg-slate-100 text-slate-500 border border-slate-200",
};

const PLATFORM_ICON = {
  Instagram: { icon: "skill-icons:instagram", color: "text-pink-500" },
  TikTok: { icon: "logos:tiktok-icon", color: "text-black" },
  YouTube: { icon: "logos:youtube-icon", color: "text-red-500" },
  Facebook: { icon: "logos:facebook", color: "text-blue-600" },
  X: { icon: "ri:twitter-x-line", color: "text-black" },
  "X (Twitter)": { icon: "ri:twitter-x-line", color: "text-black" },
  Twitter: { icon: "ri:twitter-x-line", color: "text-black" },
};

/* =========================
   MAIN
========================= */
export default function EditContent() {
  const navigate = useNavigate();
  const { id } = useParams();
  const dropdownRef = useRef(null);

  const [openPlatform, setOpenPlatform] = useState(false);
  const [loading, setLoading] = useState(false);

  const [platforms, setPlatforms] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [contentTypesByPlatform, setContentTypesByPlatform] = useState({});
  const [influencers, setInfluencers] = useState([]);

  const [useInfluencer, setUseInfluencer] = useState(false);
  const [influencerRows, setInfluencerRows] = useState([makeInfluencerRow()]);
  const [openContentAccordion, setOpenContentAccordion] = useState({});
  const [openAdsAccordion, setOpenAdsAccordion] = useState({});

  const [form, setForm] = useState({
    title: "",
    posting_date: "",
    platform_ids: [],
    selected_content_by_platform: {},
    budget_content: "",
    is_ads: false,
    ads_by_platform: {},
    description: "",
    status_id: "",
    content_links: {},
  });

  const isPosted = Number(form.status_id) === 4;
  const disabledSelect = "bg-slate-100 cursor-not-allowed";

  const [refundBudget, setRefundBudget] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  /* =========================
     MASTER DATA
  ========================== */
  useEffect(() => {
    api.get("/platforms").then((r) => setPlatforms(r.data));
    api.get("/content-statuses").then((r) => setStatusOptions(r.data));
    api.get("/content-types").then((r) => setContentTypesByPlatform(r.data));
  }, []);

  /* =========================
     OUTSIDE CLICK
  ========================== */
  useEffect(() => {
    const h = (e) =>
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target) &&
      setOpenPlatform(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* =========================
     INFLUENCERS
  ========================== */
  useEffect(() => {
    const params = form.platform_ids.length
      ? { platform_ids: form.platform_ids }
      : {};
    api.get("/influencers/all", { params }).then((r) => {
      const data = r.data.data || r.data;
      console.log("Influencers data loaded:", data);
      setInfluencers(Array.isArray(data) ? data : []);
    });
  }, [form.platform_ids]);

  /* =========================
     FETCH DETAIL
  ========================== */
  useEffect(() => {
    if (!id) return;

    setLoading(true);

    api.get(`/content-plans/${id}`)
      .then((res) => {
        const data = res.data.data ?? res.data;
        console.log("Edit Page Detail Loaded:", data);

        const platformIdsSet = new Set();
        const contentTypeMap = {};
        const links = {};
        const adsMap = {};

        // Load ads from data.ads array (direct relation on ContentPlan)
        (data.ads || []).forEach((ad) => {
          if (!adsMap[ad.platform_id]) {
            adsMap[ad.platform_id] = {
              is_ads: true,
              start_date: ad.start_date
                ? ad.start_date.slice(0, 10)
                : "",
              end_date: ad.end_date
                ? ad.end_date.slice(0, 10)
                : "",
              budget_ads: ad.budget_ads ?? "",
            };
          }
        });

        (data.content_platforms || []).forEach((cp) => {
          platformIdsSet.add(cp.platform_id);

          if (!contentTypeMap[cp.platform_id]) {
            contentTypeMap[cp.platform_id] = {};
          }

          contentTypeMap[cp.platform_id][cp.content_type_id] = {
            is_collaborator: !!cp.is_collaborator,
          };
        });

        setForm({
          title: data.title ?? "",
          posting_date: data.posting_date ? data.posting_date.slice(0, 10) : "",
          platform_ids: Array.from(platformIdsSet),
          selected_content_by_platform: contentTypeMap,
          budget_content: data.budget_with_trashed?.budget_content ?? "",
          is_ads: Object.keys(adsMap).length > 0,
          ads_by_platform: adsMap,
          description: data.description ?? "",
          status_id: data.status_id ?? "",
          content_links: {},
        });

        // Auto-expand ads accordion if ads data exists
        if (Object.keys(adsMap).length > 0) {
          const firstPlatformWithAds = Object.keys(adsMap)[0];
          setOpenAdsAccordion({ [Number(firstPlatformWithAds)]: true });
        }

        if (data.influencers?.length) {
          setUseInfluencer(true);
          setInfluencerRows(
            data.influencers.map((inf) => ({
              rowId: `row_${inf.id}`,
              influencer_id: inf.id,
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  /* =========================
     DERIVED
  ========================== */
  const selectedPlatforms = useMemo(
    () => form.platform_ids.map(Number),
    [form.platform_ids]
  );

  const availableInfluencers = useMemo(() => {
    return influencers.filter((inf) =>
      inf.platforms?.some((p) =>
        selectedPlatforms.includes(Number(p.id ?? p.platform_id))
      )
    );
  }, [influencers, selectedPlatforms]);

  const totalAdsBudget = useMemo(
    () =>
      Object.values(form.ads_by_platform || {}).reduce(
        (sum, ad) => sum + Number(ad.budget_ads || 0),
        0
      ),
    [form.ads_by_platform]
  );

  /* =========================
   INFLUENCER ROW HANDLERS
========================= */
  const addInfluencerRow = () => {
    setInfluencerRows((prev) => [...prev, makeInfluencerRow()]);
  };

  const removeInfluencerRow = (rowId) => {
    setInfluencerRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const setInfluencerInRow = (rowId, influencer_id) => {
    setInfluencerRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, influencer_id } : r))
    );
  };

  /* =========================
     HANDLERS
  ========================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handlePlatformToggle = (platformId, checked) => {
    setForm((prev) => {
      const nextIds = checked
        ? [...prev.platform_ids, platformId]
        : prev.platform_ids.filter((id) => id !== platformId);
      return { ...prev, platform_ids: nextIds };
    });
  };

  const handleContentPick = (platformId, contentTypeId) => {
    setForm((prev) => {
      const prevPlatform = prev.selected_content_by_platform[platformId] || {};

      const exists = !!prevPlatform[contentTypeId];

      const nextPlatform = { ...prevPlatform };

      if (exists) {
        delete nextPlatform[contentTypeId];
      } else {
        nextPlatform[contentTypeId] = {
          is_collaborator: false,
        };
      }

      return {
        ...prev,
        selected_content_by_platform: {
          ...prev.selected_content_by_platform,
          [platformId]: nextPlatform,
        },
      };
    });
  };

  const handleLinkChange = (platformId, contentTypeId, value) => {
    setForm((prev) => ({
      ...prev,
      content_links: {
        ...prev.content_links,
        [platformId]: {
          ...(prev.content_links?.[platformId] || {}),
          [contentTypeId]: value,
        },
      },
    }));
  };

  const handleAdsChange = (platformId, field, value) => {
    setForm((prev) => ({
      ...prev,
      ads_by_platform: {
        ...prev.ads_by_platform,
        [platformId]: {
          ...(prev.ads_by_platform?.[platformId] || {}),
          [field]: value,
        },
      },
    }));
  };

  const getPlatformName = (id) =>
    platforms.find((p) => Number(p.id) === Number(id))?.name || id;

  const getStatusIcon = (label) => {
    const found = STATUS_MASTER.find((s) => s.label === label);
    return found?.icon || "mdi:help-circle-outline";
  };

  /* =========================
     SUBMIT
  ========================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.is_ads) {
      const adsPlatforms = Object.entries(form.ads_by_platform).filter(
        ([pid, ad]) => ad && ad.is_ads
      );

      for (const [pid, ad] of adsPlatforms) {
        if (!ad.start_date || !ad.end_date || ad.budget_ads === "") {
          toast.error(
            `Platform ${platforms.find(p => p.id === Number(pid))?.name} harus mengisi semua kolom Ads`
          );
          return;
        }
      }
    }

    const adsPayload = form.is_ads
      ? Object.fromEntries(
        Object.entries(form.ads_by_platform).map(([pid, ad]) => [
          pid,
          {
            start_date: ad.start_date,
            end_date: ad.end_date,
            budget_ads: Number(ad.budget_ads || 0),
          },
        ])
      )
      : {};

    const payload = {
      title: form.title,
      posting_date: form.posting_date,
      status_id: Number(form.status_id),
      description: form.description,
      refund_budget: Number(form.status_id) === 5 ? refundBudget : false,
      budget_content: Number(form.budget_content),
      is_ads: form.is_ads,
      content_types: form.selected_content_by_platform,
      links: form.content_links,
      influencer_ids: useInfluencer
        ? influencerRows.map((r) => r.influencer_id).filter(Boolean)
        : [],
      ads_by_platform: adsPayload,
    };

    try {
      setLoading(true);
      await api.put(`/content-plans/${id}`, payload);
      toast.success("Perubahan berhasil disimpan");
      navigate(`/content/${id}`);
    } catch (err) {
      console.error("PUT Error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || "Gagal menyimpan perubahan";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI
  ========================== */
  const baseInput =
    "w-full border rounded-lg px-6 py-3 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";
  const baseSelect =
    "w-full appearance-none border rounded-lg px-6 py-3 pr-12 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none";

  // Get current status label
  const currentStatusLabel = statusOptions.find(s => s.id === Number(form.status_id))?.label || "";

  return (
    <div className="p-8 max-w-8xl mx-auto">
      <h2 className="text-4xl text-blue-900 font-bold mb-10 text-center">
        Edit Perencanaan Konten
      </h2>

      {/* ✅ LAYOUT 2 CARD (LIKE CREATE.JSX) */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
          {/* ================= LEFT CARD: INFORMASI ================= */}
          <div className="bg-white border border-blue-300 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="mdi:information-outline" width={22} className="text-blue-900" />
              <h3 className="text-xl font-extrabold text-slate-900">Informasi Konten</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Perbarui informasi dasar dan pilih platform & konten.
            </p>

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
                      budget_content: parseRupiahInput(
                        e.target.value,
                        prev.budget_content
                      ),
                    }));
                  }}
                  placeholder="Masukkan budget konten"
                />
              </Field>

              {/* DESKRIPSI (opsional) */}
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
                    type="button"
                    onClick={() => !isPosted && setOpenPlatform((s) => !s)}
                    className={`${baseSelect} text-left relative ${isPosted ? disabledSelect : ""}`}
                  >
                    <span className={form.platform_ids.length ? "text-slate-800" : "text-slate-400"}>
                      {form.platform_ids.length
                        ? platforms
                          .filter((p) => form.platform_ids.includes(p.id))
                          .map((p) => p.name)
                          .join(", ")
                        : "Pilih Platform"}
                    </span>
                    <Icon
                      icon="mdi:chevron-down"
                      width={22}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </button>

                  {openPlatform && !isPosted && (
                    <div className="absolute z-30 mt-2 w-full bg-white border-2 rounded-lg shadow-xl p-4 space-y-3">
                      {platforms.map((p) => {
                        const pIcon = PLATFORM_ICON[p.name];
                        return (
                          <label key={p.id} className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={form.platform_ids.includes(p.id)}
                              onChange={(e) => handlePlatformToggle(p.id, e.target.checked)}
                            />
                            {pIcon && <Icon icon={pIcon.icon} width={20} />}
                            <span>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Toggle Influencer */}
                {form.platform_ids.length > 0 && (
                  <div className="mt-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useInfluencer}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUseInfluencer(checked);
                          setInfluencerRows(checked ? influencerRows : [makeInfluencerRow()]);
                        }}
                        className="scale-125"
                      />
                      <span className="font-bold text-slate-800">Gunakan Influencer</span>
                      <span className="text-xs text-slate-500">(opsional)</span>
                    </label>

                    {useInfluencer && (
                      <div className="mt-4 rounded-xl bg-white border border-slate-200 shadow-sm p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-800">Influencer</div>
                            <div className="text-sm text-slate-500">
                              Pilih influencer sesuai platform yang kamu pilih
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={addInfluencerRow}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white transition"
                          >
                            <Icon icon="mdi:plus" width={18} />
                            Tambah
                          </button>
                        </div>

                        {/* Scrollable influencer list - max 2 visible, scroll for more */}
                        <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1">
                          {influencerRows.map((row, idx) => {
                            const selectedInf = availableInfluencers.find(
                              (x) => Number(x.id) === Number(row.influencer_id)
                            );

                            const alreadyPicked = new Set(
                              influencerRows
                                .filter((r) => r.rowId !== row.rowId)
                                .map((r) => r.influencer_id)
                                .filter(Boolean)
                            );

                            const optionsForThisRow = availableInfluencers.filter(
                              (inf) => !alreadyPicked.has(inf.id) || inf.id === row.influencer_id
                            );

                            return (
                              <div key={row.rowId} className="bg-white border rounded-xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="text-sm font-bold text-slate-700 mb-2">
                                      Influencer {idx + 1}
                                    </div>

                                    <div className="relative">
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

                                    {selectedInf && (
                                      <div className="mt-3 space-y-4">
                                        <div className="text-sm font-bold text-slate-800">
                                          {selectedInf.name}
                                        </div>

                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {(selectedInf.platforms || []).map((p) => (
                                            <div
                                              key={p.id ?? `${selectedInf.id}_${p.username}`}
                                              className="flex items-center justify-between border rounded-lg px-4 py-3 min-h-[72px]"
                                            >
                                              <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-700">
                                                  {p.platform?.name || p.name || "-"}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                  {p.username || "-"}
                                                </span>
                                              </div>
                                              <div className="text-sm font-bold text-slate-800">
                                                {formatFollowers(p.followers)}
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {(selectedInf.email ||
                                          (selectedInf.contacts && selectedInf.contacts.length > 0)) && (
                                            <div className="mt-4 border-t pt-4">
                                              <div className="text-sm font-bold text-slate-700 mb-2">
                                                CP (Kontak Person)
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedInf.email && (
                                                  <div className="border rounded-lg px-4 py-3">
                                                    <div className="text-xs font-semibold text-slate-500">
                                                      Email
                                                    </div>
                                                    <div className="text-sm text-slate-800">
                                                      {selectedInf.email}
                                                    </div>
                                                  </div>
                                                )}

                                                {selectedInf.contacts?.map((c, i) => (
                                                  <div
                                                    key={`${selectedInf.id}_cp_${i}`}
                                                    className="border rounded-lg px-4 py-3"
                                                  >
                                                    <div className="text-xs font-semibold text-slate-500">
                                                      No. Telepon
                                                    </div>
                                                    <div className="text-sm text-slate-800">{c}</div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Icon icon="mdi:form-select" width={22} className="text-blue-900" />
              <h3 className="text-xl font-extrabold text-slate-900">Detail Konten</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Edit status, jenis konten per platform, dan atur ads.
            </p>

            <div className="space-y-10">
              {/* STATUS FIELD WITH COLORFUL BADGE */}
              <Field label={<span className="text-lg font-bold">Status</span>} required>
                <div className="space-y-3">
                  {/* Current Status Badge */}
                  {currentStatusLabel && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Status saat ini:</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${statusStyle[currentStatusLabel] || "bg-slate-100 text-slate-600"}`}>
                        <Icon icon={getStatusIcon(currentStatusLabel)} width={16} />
                        {currentStatusLabel}
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <select
                      name="status_id"
                      value={form.status_id}
                      onChange={(e) => {
                        const nextStatus = Number(e.target.value);

                        if (nextStatus === 5 && Number(form.status_id) !== 5) {
                          setPendingStatus(nextStatus);
                          setShowRefundModal(true);
                          return;
                        }

                        setForm((p) => ({
                          ...p,
                          status_id: nextStatus,
                        }));
                      }}
                      className={`${baseSelect} pr-12`}
                    >
                      <option value="">Pilih Status</option>
                      {statusOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <Icon
                      icon="mdi:chevron-down"
                      width={22}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </Field>

              {/* KONTEN (ACCORDION PER PLATFORM) */}
              <Field label="Konten" required>
                {!selectedPlatforms.length ? (
                  <div className="text-slate-500 text-sm">
                    Pilih platform dulu untuk menampilkan pilihan konten.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-500">
                      Pilih <span className="font-semibold">jenis konten</span> untuk setiap platform.
                    </div>

                    {selectedPlatforms.map((pid) => {
                      const platform = platforms.find((p) => p.id === pid);
                      const types = contentTypesByPlatform[String(pid)] || [];
                      const pIcon = PLATFORM_ICON[platform?.name];
                      const pickedObj = form.selected_content_by_platform?.[pid] || null;
                      const pickedNames =
                        pickedObj && Object.keys(pickedObj).length > 0
                          ? Object.keys(pickedObj)
                            .map((id) =>
                              types.find((t) => Number(t.id) === Number(id))?.name
                            )
                            .filter(Boolean)
                          : [];

                      const isOpen = !!openContentAccordion?.[pid];

                      return (
                        <div
                          key={pid}
                          className="border rounded-xl bg-white shadow-sm overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              // Exclusive accordion - only one open at a time
                              const isCurrentlyOpen = openContentAccordion?.[pid] ?? false;
                              setOpenContentAccordion(isCurrentlyOpen ? {} : { [pid]: true });
                            }}
                            className="w-full flex items-start justify-between gap-4 px-4 py-4"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              {pIcon && <Icon icon={pIcon.icon} width={20} className="shrink-0" />}
                              <div className="font-bold text-slate-800">
                                {platform?.name}
                              </div>
                              <span className="text-xs text-slate-500 ml-2">
                                {pickedNames.length ? (
                                  <>({pickedNames.join(", ")})</>
                                ) : (
                                  "(Belum dipilih)"
                                )}
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
                                  const platformName = platform?.name;
                                  const isStory = t.name?.toLowerCase() === "story";
                                  const isX = platformName?.toLowerCase() === "x";
                                  const canUseCollaborator = !isStory && !isX;
                                  const selected =
                                    form.selected_content_by_platform?.[pid]?.[t.id];

                                  return (
                                    <div
                                      key={`${pid}_${t.id}`}
                                      className={`flex-1 min-w-[180px] min-h-[120px] border rounded-lg p-4 space-y-3
                                        ${selected
                                          ? "border-blue-600 bg-blue-50"
                                          : "border-slate-200"
                                        }
                                      `}
                                    >
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={!!selected}
                                          disabled={isPosted}
                                          onChange={() => handleContentPick(pid, t.id)}
                                          className="scale-125"
                                        />
                                        {pIcon && <Icon icon={pIcon.icon} width={18} className="shrink-0" />}
                                        <span className="font-medium">{t.name}</span>
                                      </label>

                                      {selected && (
                                        <div className="pl-7 space-y-1 text-sm">
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
                                              <span>Aktifkan collaborator</span>
                                            </label>
                                          )}

                                          {isStory && (
                                            <div className="text-xs text-red-500">
                                              Story tidak mendukung collaborator
                                            </div>
                                          )}

                                          {isX && (
                                            <div className="text-xs text-red-500">
                                              Platform X tidak mendukung collaborator
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Link input for posted status */}
                              {Number(form.status_id) === 4 &&
                                Object.entries(form.selected_content_by_platform?.[pid] || {}).map(
                                  ([contentTypeId]) => {
                                    const contentType = types.find(
                                      (t) => String(t.id) === String(contentTypeId)
                                    );

                                    return (
                                      <input
                                        key={contentTypeId}
                                        type="url"
                                        placeholder={`Link ${platform?.name} - ${contentType?.name}`}
                                        value={form.content_links?.[pid]?.[contentTypeId] || ""}
                                        onChange={(e) =>
                                          handleLinkChange(pid, contentTypeId, e.target.value)
                                        }
                                        className={`${baseInput} mt-3`}
                                      />
                                    );
                                  }
                                )}

                              {types.length === 0 && (
                                <div className="mt-3 text-sm text-slate-500">
                                  Tidak ada konten untuk platform ini.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Field>

              {/* ADS (opsional) - accordion */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_ads}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      is_ads: e.target.checked,
                    }))
                  }
                  className="scale-125"
                />
                <span className="font-bold text-slate-800">Aktifkan Ads</span>
                <span className="text-xs text-slate-500">(opsional)</span>
              </label>

              {form.is_ads &&
                selectedPlatforms.map((pid) => {
                  const platform = platforms.find((p) => p.id === pid);
                  const pIcon = PLATFORM_ICON[platform?.name];
                  const isOpen = !!openAdsAccordion[pid];
                  const ads = form.ads_by_platform[pid] || {};

                  return (
                    <div
                      key={pid}
                      className="border rounded-xl bg-white shadow-sm overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          // Exclusive accordion - only one open at a time
                          const isCurrentlyOpen = !!openAdsAccordion[pid];
                          setOpenAdsAccordion(isCurrentlyOpen ? {} : { [pid]: true });
                        }}
                        className="w-full flex items-center justify-between px-4 py-4"
                      >
                        <div className="flex items-center gap-2">
                          {pIcon && <Icon icon={pIcon.icon} width={20} />}
                          <div className="font-bold text-slate-800">
                            Ads – {platform?.name}
                          </div>
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
                                value={ads.start_date || ""}
                                onChange={(e) =>
                                  handleAdsChange(pid, "start_date", e.target.value)
                                }
                                min={form.posting_date || ""}
                              />
                            </Field>

                            <Field label="Tanggal Selesai Ads">
                              <input
                                type="date"
                                className={baseInput}
                                value={ads.end_date || ""}
                                onChange={(e) =>
                                  handleAdsChange(pid, "end_date", e.target.value)
                                }
                                min={ads.start_date || form.posting_date || ""}
                              />
                            </Field>

                            <Field label="Budget Ads">
                              <input
                                type="number"
                                className={baseInput}
                                placeholder="Masukkan budget ads"
                                value={ads.budget_ads || ""}
                                onChange={(e) =>
                                  handleAdsChange(pid, "budget_ads", e.target.value)
                                }
                              />
                            </Field>
                          </div>

                          <div className="text-xs text-slate-500">
                            Kosongkan jika tidak ingin menggunakan ads di platform ini
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* TOTAL BUDGET */}
              <div className="border rounded-xl p-4 bg-slate-50">
                <div className="text-sm text-slate-500 mb-1">Total Budget</div>
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
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/content/${id}`)}
                  className="text-gray-600 hover:underline"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div >
      </form >

      {/* REFUND MODAL */}
      {
        showRefundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-xl font-bold text-blue-900 mb-2">
                Refund Budget?
              </h3>

              <p className="text-slate-600 mb-6">
                Apakah Anda ingin melakukan refund budget untuk konten ini?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRefundBudget(false);
                    setForm((p) => ({
                      ...p,
                      status_id: pendingStatus,
                    }));
                    setShowRefundModal(false);
                    setPendingStatus(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                >
                  Tidak
                </button>

                <button
                  onClick={() => {
                    setRefundBudget(true);
                    setForm((p) => ({
                      ...p,
                      status_id: pendingStatus,
                    }));
                    setShowRefundModal(false);
                    setPendingStatus(null);
                  }}
                  className="px-5 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800 transition"
                >
                  Ya, Refund
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

/* =========================
   FIELD
========================= */
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block mb-3 font-bold">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}