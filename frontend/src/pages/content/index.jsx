import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/axios";
import toast from "react-hot-toast";

/* ========================= STATUS MASTER (WAJIB TAMPIL) ========================= */
const STATUS_MASTER = [
  { label: "Terjadwal", icon: "solar:calendar-linear" },
  { label: "Sedang Dibuat", icon: "proicons:pencil" },
  { label: "Draf", icon: "proicons:document" },
  { label: "Diposting", icon: "meteor-icons:bullhorn" },
  { label: "Dibatalkan", icon: "gg:close-o" },
  { label: "Diblokir", icon: "mdi:block-helper" },
];

const PRIORITY_STATUS = ["Draf", "Terjadwal", "Sedang Dibuat"];

/* ========================= FOLLOWERS HELPERS ========================= */
const MAX_FOLLOWERS = 999_999_999;

function formatFollowersInput(value) {
  if (!value) return "";
  const number = Number(value);
  if (isNaN(number)) return "";
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseFollowersInput(value, prevValue = "") {
  const raw = value.replace(/\D/g, "");
  if (!raw) return "";
  const num = Number(raw);
  if (num > MAX_FOLLOWERS) return prevValue;
  return raw;
}

/* ========================= KOMPONEN ANIMATED NUMBER ========================= */
const AnimatedNumber = ({ value, duration = 1500 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * Number(value || 0)));

      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  return <>{displayValue.toLocaleString("id-ID")}</>;
};

/* ========================= PLATFORM ICON MAP ========================= */
const PLATFORM_ICON = {
  ig: { icon: "skill-icons:instagram", color: "text-pink-500" },
  tt: { icon: "logos:tiktok-icon", color: "text-black" },
  yt: { icon: "logos:youtube-icon", color: "text-red-500" },
  fb: { icon: "logos:facebook", color: "text-blue-600" },
  x: { icon: "ri:twitter-x-line", color: "text-black" },
};

const statusStyle = {
  Diposting: "bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold ",
  Terjadwal: "bg-blue-100 text-blue-700 border border-blue-200 font-bold  ",
  Diblokir: "bg-slate-800 text-white shadow-sm font-bold ",
  Dibatalkan: "bg-rose-100 text-rose-700 border border-rose-200 font-bold ",
  "Sedang Dibuat": "bg-amber-100 text-amber-800 border border-amber-200 font-bold ",
  Draf: "bg-slate-100 text-slate-500 border border-slate-200 font-medium ",
};

const PLATFORM_NAME_TO_CODE = {
  Instagram: "ig",
  TikTok: "tt",
  YouTube: "yt",
  Facebook: "fb",
  "X (Twitter)": "x",
  X: "x",
  Twitter: "x",
};

const PLATFORM_ALIAS = {
  ig: "instagram",
  tt: "tiktok",
  yt: "youtube",
  fb: "facebook",
  x: "twitter",
};

/* ========================= NORMALIZE HELPER ========================= */
const normalizeSearchKeyword = (value = "") => {
  const v = value.toLowerCase().trim();
  if (v === "x") return "twitter";
  if (v === "twitter") return "twitter";
  return v;
};

export default function Index() {
  const navigate = useNavigate();

  // ========================= CONTENT LIST (SERVER-SIDE) =========================
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [lateCountGlobal, setLateCountGlobal] = useState(0);

  // FILTERS (semua dikirim ke server)
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [sortKey, setSortKey] = useState(""); // "tanggal" / "budget" / ""

  // Pagination (server-side)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalPage, setTotalPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  // Late modal (server-side optional)
  const [showLateModal, setShowLateModal] = useState(false);

  // ========================= BUDGET =========================
  const [budgetSummary, setBudgetSummary] = useState({
    total_budget: 0,
    used_budget: { content: 0, ads: 0, total: 0 },
    remaining_budget: 0,
  });

  // ========================= PLATFORMS MASTER =========================
  const [platforms, setPlatforms] = useState([]);

  // ========================= INFLUENCER LIST (SERVER-SIDE) =========================
  const [showInfluencerModal, setShowInfluencerModal] = useState(false);
  const [rows, setRows] = useState([]);
  const [loadingInfluencer, setLoadingInfluencer] = useState(false);
  const [infPage, setInfPage] = useState(1);
  const [infPerPage] = useState(5);
  const [infTotalPage, setInfTotalPage] = useState(1);
  const [infSearch, setInfSearch] = useState("");
  const [debouncedInfSearch, setDebouncedInfSearch] = useState("");
  const [infPlatformFilter, setInfPlatformFilter] = useState("");

  // Contact modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);

  // Edit influencer modal
  const [showEditInfluencerModal, setShowEditInfluencerModal] = useState(false);
  const [editingInfluencer, setEditingInfluencer] = useState(null);
  const [savingEditInfluencer, setSavingEditInfluencer] = useState(false);

  // ========================= DELETE MODAL =========================
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setSelectedItem(null);
    setShowDeleteModal(false);
  };

  // ========================= SERVER-SIDE FETCH CONTENT =========================
  const fetchContentPlans = async () => {
    setLoading(true);

    try {
      const res = await api.get("/content-plans", {
        params: {
          page,
          per_page: perPage,
          status: statusFilter || undefined,
          search: searchTitle?.trim() || undefined,
          platform: platformFilter || undefined,
          date: dateFilter || undefined,
          min_budget: minBudget || undefined,
          sort_by:
            sortKey === "tanggal"
              ? "posting_date"
              : sortKey === "budget"
              ? "budget"
              : undefined,
          sort_dir: sortKey ? (sortKey === "tanggal" ? "asc" : "desc") : undefined,
        },
      });

      const payload = res.data;
      const data = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

        setPlans(data);

        if (payload?.stats) {
          setStats(payload.stats);
        } else {
          setStats(hitungStatistik(data));
        }
        
        // ===== LATE COUNT GLOBAL =====
        if (typeof payload?.late_count === "number") {
          setLateCountGlobal(payload.late_count);
        } else {
          setLateCountGlobal(0);
        }        

      // paginator meta
      setTotalPage(
        Number(payload?.last_page || payload?.meta?.last_page || 1)
      );
      setTotalRows(Number(payload?.total || payload?.meta?.total || data.length));
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data konten");
      setPlans([]);
      setStats({});
      setTotalPage(1);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudget = async () => {
    try {
      const res = await api.get("/budget");
      setBudgetSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPlatforms = async () => {
    try {
      const res = await api.get("/platforms");
      setPlatforms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Gagal fetch platforms:", err);
    }
  };

  // Trigger fetch content + budget
  useEffect(() => {
    fetchContentPlans();
    fetchBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, perPage, searchTitle, platformFilter, dateFilter, minBudget, sortKey]);

  // Fetch platforms once
  useEffect(() => {
    fetchPlatforms();
  }, []);

  // Reset page ketika filter berubah
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchTitle, platformFilter, dateFilter, minBudget, sortKey, perPage]);

  // Keep page within totalPage
  useEffect(() => {
    if (page > totalPage) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPage]);

  // ========================= LATE PLANS =========================
  // NOTE: ini tetap client-side karena datanya udah dipaginate server.
  // Kalau kamu mau akurat total late seluruh dataset, minta backend return `late_count` & `late_items`.
  const latePlans = useMemo(() => plans.filter((p) => p.is_late === 1), [plans]);
  const lateCount = latePlans.length;

  // ========================= SERVER-SIDE FETCH INFLUENCERS =========================
  const fetchInfluencers = async () => {
    try {
      setLoadingInfluencer(true);

      const res = await api.get("/influencers", {
        params: {
          page: infPage,
          per_page: infPerPage,
          search: debouncedInfSearch,
          platform: infPlatformFilter || undefined,
        },
      });

      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      setInfTotalPage(Number(res.data?.last_page || 1));
    } catch (err) {
      console.error(err);
      setRows([]);
      setInfTotalPage(1);
    } finally {
      setLoadingInfluencer(false);
    }
  };

  useEffect(() => {
    if (showInfluencerModal) fetchInfluencers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInfluencerModal, infPage, debouncedInfSearch, infPlatformFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInfSearch(normalizeSearchKeyword(infSearch));
    }, 400);
    return () => clearTimeout(timer);
  }, [infSearch]);

  // ========================= UPDATE INFLUENCER =========================
  const handleUpdateInfluencer = async () => {
    if (!editingInfluencer?.id) {
      toast.error("Influencer tidak valid");
      return;
    }
    if (!editingInfluencer.name?.trim()) {
      toast.error("Nama influencer wajib diisi");
      return;
    }

    const hasEmail = !!editingInfluencer.email;
    const hasPhone =
      Array.isArray(editingInfluencer.contacts) &&
      editingInfluencer.contacts.length > 0;

    if (!hasEmail && !hasPhone) {
      toast.error("Mohon lengkapi email atau nomor telepon");
      return;
    }

    if (!editingInfluencer.platforms?.length) {
      toast.error("Influencer harus punya minimal satu platform");
      return;
    }

    try {
      setSavingEditInfluencer(true);

      await api.put(`/influencers/${editingInfluencer.id}`, {
        name: editingInfluencer.name,
        email: editingInfluencer.email || null,
        contacts: editingInfluencer.contacts || [],
        platforms: editingInfluencer.platforms.map((p) => ({
          platform_id: p.platform_id,
          username: p.username,
          followers: Number(p.followers || 0),
        })),
      });

      toast.success("Influencer berhasil diperbarui");

      setShowEditInfluencerModal(false);
      setEditingInfluencer(null);
      setShowInfluencerModal(true);

      await fetchInfluencers();
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui influencer");
    } finally {
      setSavingEditInfluencer(false);
    }
  };

  // ========================= DELETE CONTENT =========================
  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      setDeleting(true);
      await api.delete(`/content-plans/${selectedItem.id}`);
      closeDeleteModal();
      fetchContentPlans();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus data");
    } finally {
      setDeleting(false);
    }
  };

  // ========================= UI =========================
  const pages = useMemo(() => {
    const max = Math.max(1, Number(totalPage || 1));
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [totalPage]);

  return (
    <div className="p-6 space-y-6">
      {/* ================= HEADER ================= */}
      <div className="bg-white rounded-lg p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-900">Social Media</h1>
          <p className="text-sm opacity-90 mt-1"></p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:ml-auto">
          <button
            className="bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-blue-800 w-full sm:w-auto"
            onClick={() => {
              setShowInfluencerModal(true);
              setInfPage(1);
            }}
          >
            Lihat Influencer
          </button>

          <button
            className="bg-blue-900 text-white px-6 py-3 rounded-lg hover:bg-blue-800 w-full sm:w-auto"
            onClick={() => navigate("/content/create")}
          >
            Tambah Konten +
          </button>
        </div>
      </div>

      {/* ================= BUDGET ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-950 rounded-2xl p-6 shadow-lg transition-all duration-300 hover:scale-[1.02] flex justify-between items-center cursor-pointer group">
          <div>
            <div className="text-slate-300 text-xs font-bold uppercase tracking-wider">
              Total Anggaran
            </div>
            <div className="text-2xl font-extrabold mt-1 text-white">
              <span className="text-sm mr-1">Rp</span>
              <AnimatedNumber value={Number(budgetSummary.total_budget)} />
            </div>
          </div>
          <div className="bg-white/10 p-3 rounded-xl text-white/50 group-hover:text-white transition-colors">
            <Icon icon="solar:wallet-bold" width={32} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-700 rounded-2xl p-6 shadow-lg shadow-rose-200 transition-all duration-300 hover:scale-[1.02] flex justify-between items-center cursor-pointer group relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
          <div className="relative z-10">
            <div className="text-rose-100 text-xs font-bold uppercase tracking-wider">
              Anggaran Terpakai
            </div>
            <div className="text-2xl font-extrabold mt-1 text-white">
              <span className="text-sm mr-1">Rp</span>
              <AnimatedNumber value={Number(budgetSummary.used_budget?.total || 0)} />
            </div>
          </div>
          <div className="bg-white/20 p-3 rounded-xl text-white/70 group-hover:text-white transition-colors">
            <Icon icon="mdi:cash-minus" width={32} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-6 shadow-lg shadow-emerald-200 transition-all duration-300 hover:scale-[1.02] flex justify-between items-center cursor-pointer group">
          <div>
            <div className="text-emerald-100 text-xs font-bold uppercase tracking-wider">
              Anggaran Tersisa
            </div>
            <div className="text-2xl font-extrabold mt-1 text-white">
              <span className="text-sm mr-1">Rp</span>
              <AnimatedNumber value={Number(budgetSummary.remaining_budget)} />
            </div>
          </div>
          <div className="bg-white/20 p-3 rounded-xl text-white/70 group-hover:text-white transition-colors">
            <Icon icon="ph:piggy-bank-fill" width={32} />
          </div>
        </div>
      </div>

      {/* ================= STATISTIK STATUS (COMPACT) ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_MASTER.map((statusObj) => (
          <div
            key={statusObj.label}
            className="bg-white border rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Icon icon={statusObj.icon} width={18} className="text-slate-600" />
            </div>

            <div>
              <div className="text-lg font-bold text-slate-800">
                <AnimatedNumber value={stats[statusObj.label] || 0} duration={1200} />
              </div>
              <div className="text-xs text-slate-500">{statusObj.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ================= FILTER DATA ================= */}
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Icon icon="mdi:filter-variant" width={22} className="text-blue-900" />
          <div>
            <h3 className="font-semibold">Filter Data</h3>
            <p className="text-sm text-slate-500">Cari data berdasarkan kriteria</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SEARCH TITLE */}
          <input
            type="text"
            value={searchTitle}
            onChange={(e) => {
              setSearchTitle(e.target.value);
              setPage(1);
            }}
            placeholder="Cari judul, platform, tanggal posting, ads"
            className="border border-gray-400 rounded-lg px-4 py-3 w-full outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 placeholder:text-slate-400"
          />

          {/* FILTER STATUS */}
          <div className="relative group">
            <Icon
              icon="mdi:chevron-down"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors"
              width="22"
            />
            <select
              className={`w-full appearance-none border border-gray-400 pl-5 pr-12 py-3 rounded-lg outline-none transition-all duration-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-600 ${
                statusFilter ? "text-slate-800" : "text-slate-400"
              }`}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua Status</option>
              {STATUS_MASTER.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ================= PER PAGE ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span>Tampilkan</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="border rounded-lg px-3 py-1"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>data</span>
        </div>

        {(lateCountGlobal || lateCount) > 0 && (
          <div
            onClick={() => setShowLateModal(true)}
            className="cursor-pointer bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl px-6 py-3 shadow-md hover:scale-[1.03] transition flex items-center gap-4 w-fit"
          >
            <div>
              <div className="text-xs font-semibold text-orange-100 uppercase tracking-wide leading-none">
                Konten Terlambat
              </div>
              <div className="text-xl font-extrabold text-white leading-tight">{lateCountGlobal || lateCount}</div>
            </div>
            <div className="bg-white/20 p-1.5 rounded-md">
              <Icon icon="mdi:alert-circle-outline" width={18} className="text-white" />
            </div>
          </div>
        )}
      </div>

      {/* ================= TABLE (DESKTOP) ================= */}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-base">
          <thead className="bg-slate-100">
            <tr className="text-slate-700">
              <th className="px-4 py-4 text-left font-bold">No</th>
              <th className="px-4 py-4 text-left font-bold">Judul</th>
              <th className="px-4 py-4 text-left font-bold">Platform</th>
              <th className="px-4 py-4 text-left font-bold">Tanggal Posting</th>
              <th className="px-4 py-4 text-center font-bold">Ads</th>
              <th className="px-4 py-4 text-left font-bold">Total Anggaran</th>
              <th className="px-4 py-4 text-center font-bold">Status</th>
              <th className="px-4 py-4 text-center font-bold">Aksi</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan="8" className="py-10 text-center text-slate-500 italic">
                  Memuat data konten...
                </td>
              </tr>
            )}

            {!loading && plans.length === 0 && (
              <tr>
                <td colSpan="8" className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2 opacity-60">
                    <Icon icon="mdi:database-off-outline" width={48} />
                    <p className="font-semibold text-lg">Data belum tersedia</p>
                    <p className="text-sm">Belum ada rencana konten yang dibuat.</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              plans.map((item, index) => {
                const totalBudget = getTotalBudget(item);
                return (
                  <tr
                    key={item.id}
                    className="group hover:bg-blue-50/40 transition-colors duration-200"
                  >
                    <td className="px-4 py-4 text-slate-500">
                      {(page - 1) * perPage + index + 1}
                    </td>

                    <td className="px-4 py-4 max-w-[260px]">
                      <p className="font-bold text-slate-800 line-clamp-2 leading-tight">
                        {item.title}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2 items-center">{getPlatformIcons(item)}</div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {item.posting_date
                        ? new Date(item.posting_date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {hasAds(item) ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-sm">
                          Ya
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-sm">
                          Tidak
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-bold text-slate-900">
                      Rp {totalBudget.toLocaleString("id-ID")}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-block min-w-[100px] px-4 py-1.5 rounded-full text-xs font-bold ${
                          statusStyle[item.status?.label] ||
                          "bg-slate-100 text-slate-600 font-semibold"
                        }`}
                      >
                        {item.status?.label || "-"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => navigate(`/content/${item.id}`)}
                          title="Lihat Detail"
                          className="w-9 h-9 flex items-center justify-center text-blue-600 border border-blue-400 bg-white rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <Icon icon="si:eye-line" width={18} />
                        </button>

                        <button
                          onClick={() => navigate(`/content/${item.id}/analytic`)}
                          title="Analitik"
                          className="w-9 h-9 flex items-center justify-center text-purple-600 border border-purple-400 bg-white rounded-lg hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                        >
                          <Icon icon="stash:chart-trend-up" width={18} />
                        </button>

                        <button
                          onClick={() => openDeleteModal(item)}
                          title="Hapus"
                          className="w-9 h-9 flex items-center justify-center text-rose-600 border border-rose-300 bg-white rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        >
                          <Icon icon="mdi:trash-outline" width={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* ================= MOBILE CARD (SERVER DATA) ================= */}
      <div className="md:hidden space-y-4">
        {loading && <div className="text-center text-slate-500 py-6">Loading...</div>}

        {!loading && plans.length === 0 && (
          <div className="text-center text-slate-500 py-10">
            <Icon icon="mdi:database-off-outline" width={36} className="mx-auto mb-2" />
            <p className="font-medium">Data belum tersedia</p>
            <p className="text-sm opacity-70">Belum ada konten yang bisa ditampilkan</p>
          </div>
        )}

        {!loading &&
          plans.map((item, index) => {
            const totalBudget = getTotalBudget(item);
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 leading-snug line-clamp-2 text-[15px]">
                      {item.title}
                    </p>
                    <span className="text-xs text-slate-400">
                      #{(page - 1) * perPage + index + 1}
                    </span>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[11px] ${
                        statusStyle[item.status?.label] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status?.label || "-"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-y border-slate-50 py-2">
                  <div className="flex gap-1.5">{getPlatformIcons(item)}</div>
                  <div className="text-right">
                    <p className="text-[10px] text-black">Tanggal Posting</p>
                    <p className="text-xs font-semibold text-black">
                      {item.posting_date
                        ? new Date(item.posting_date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-black font-semibold">Total Budget</p>
                    <p className="text-lg text-black leading-none">
                      Rp {totalBudget.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-[11px] font-bold ${
                        hasAds(item) ? "text-green-600" : "text-slate-400"
                      }`}
                    >
                      {hasAds(item) ? "● Ads Aktif" : "Tanpa Ads"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => navigate(`/content/${item.id}/analytic`)}
                    className="flex-1 bg-purple-100 text-purple-700 py-2.5 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Icon icon="stash:chart-trend-up" width={20} />
                    <span className="ml-2 text-xs font-bold">Analisis</span>
                  </button>

                  <button
                    onClick={() => navigate(`/content/${item.id}`)}
                    className="flex-1 bg-blue-100 text-blue-700 py-2.5 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Icon icon="si:eye-line" width={18} />
                    <span className="ml-2 text-xs font-bold">Detail</span>
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* ================= PAGINATION ================= */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-3">
        <div className="text-sm text-slate-500">
          Halaman {page} dari {totalPage} • Total {totalRows} data
        </div>

        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-50"
          >
            Sebelumnya
          </button>

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded-lg border ${
                p === page ? "bg-blue-900 text-white border-blue-900" : "hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            disabled={page === totalPage}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 border rounded-lg disabled:opacity-50"
          >
            Selanjutnya
          </button>
        </div>
      </div>

      {/* ================= DELETE MODAL ================= */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <p className="text-slate-600 mb-6">
              Yakin ingin menghapus konten
              <span className="font-semibold text-slate-800"> {`“${selectedItem?.title}”`}</span>?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KONTEN TERLAMBAT ================= */}
      {showLateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-bold text-orange-600 mb-2">Konten Terlambat</h3>

            <p className="text-sm text-slate-500 mb-4">
              Konten berikut melewati tanggal posting namun belum diposting.
            </p>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {latePlans.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setShowLateModal(false);
                    navigate(`/content/${item.id}`);
                  }}
                  className="border rounded-lg p-3 hover:bg-orange-50 cursor-pointer transition"
                >
                  <p className="font-semibold text-slate-800 line-clamp-1">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.posting_date
                      ? new Date(item.posting_date).toLocaleDateString("id-ID")
                      : "-"}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowLateModal(false)}
                className="px-5 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL INFLUENCER ================= */}
      {showInfluencerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowInfluencerModal(false)}
          />

          <div className="relative bg-white w-[95vw] max-w-7xl h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl shadow-xl flex flex-col">
            {/* HEADER (yang udah kamu set) */}
            <div className="px-6 py-4 border-b shrink-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">Daftar Influencer</h2>
                <button
                  onClick={() => setShowInfluencerModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 shrink-0"
                >
                  <Icon icon="solar:close-circle-bold" width={26} />
                </button>
              </div>

              <div className="mt-4 flex flex-col md:flex-row gap-3">
                <input
                  value={infSearch}
                  onChange={(e) => {
                    setInfSearch(e.target.value);
                    setInfPage(1);
                  }}
                  placeholder="Cari nama atau username..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm"
                />

                <select
                  value={infPlatformFilter}
                  onChange={(e) => {
                    setInfPlatformFilter(e.target.value);
                    setInfPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                >
                  <option value="">Semua Platform</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Facebook">Facebook</option>
                  <option value="X">X</option>
                </select>
              </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 min-h-0 px-4 md:px-8 py-4">
              {/* DESKTOP */}
              <div className="hidden md:block h-full overflow-y-auto">
                <table className="w-full table-fixed">
                  <thead className="sticky top-0 bg-white z-10 border-b">
                    <tr className="text-sm text-slate-500">
                      <th className="px-4 py-3 text-left w-[220px]">Nama</th>
                      {["Instagram", "TikTok", "YouTube", "Facebook", "X"].map((p) => {
                        const icon = getPlatformIcon(p);
                        return (
                          <th key={p} className="px-4 py-3 text-center w-[150px]">
                            <Icon icon={icon.icon} width={18} className="mx-auto" />
                            <div className="text-xs">{p}</div>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-center w-[100px]">Kontak</th>
                      <th className="px-4 py-3 text-center w-[80px]">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loadingInfluencer && (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          Loading influencer...
                        </td>
                      </tr>
                    )}

                    {!loadingInfluencer &&
                      rows.map((inf) => {
                        const ig = getPlatformData(inf.platforms, "Instagram");
                        const tt = getPlatformData(inf.platforms, "TikTok");
                        const yt = getPlatformData(inf.platforms, "YouTube");
                        const fb = getPlatformData(inf.platforms, "Facebook");
                        const x = getPlatformData(inf.platforms, "X");

                        return (
                          <tr key={inf.id} className="border-t text-sm">
                            <td className="px-4 py-3 font-semibold">{inf.name}</td>

                            {[ig, tt, yt, fb, x].map((p, i) => (
                              <td key={i} className="px-4 py-3 text-center">
                                {p ? formatFollowersShort(p.followers) : "-"}
                              </td>
                            ))}

                            <td className="px-4 py-3 text-center">
                              {inf.contacts?.length || inf.email ? (
                                <button
                                  onClick={() => {
                                    setSelectedInfluencer(inf);
                                    setSelectedContact({
                                      whatsapp: inf.contacts || [],
                                      email: inf.email || null,
                                    });
                                    setShowContactModal(true);
                                  }}
                                  className="text-green-600 text-xs font-semibold"
                                >
                                  Hubungi
                                </button>
                              ) : (
                                "-"
                              )}
                            </td>

                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setEditingInfluencer({
                                    id: inf.id,
                                    name: inf.name || "",
                                    email: inf.email || "",
                                    contacts: inf.contacts || [],
                                    platforms: (inf.platforms || []).map((p) => ({
                                      platform_id: p.id,
                                      username: p.username,
                                      followers: p.followers,
                                    })),
                                  });
                                  setShowInfluencerModal(false);
                                  setShowEditInfluencerModal(true);
                                }}
                                className="text-blue-600"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="md:hidden h-full overflow-y-auto space-y-4">
                {rows.map((inf) => {
                  const pf = inf.platforms || [];
                  return (
                    <div key={inf.id} className="border rounded-xl p-4 shadow-sm space-y-3">
                      <div className="font-bold text-slate-800">{inf.name}</div>

                      <div className="space-y-2 text-sm">
                        {pf.map((p, i) => {
                          const platformName = p.platform?.name || p.name;
                          const icon = getPlatformIcon(platformName);
                          return (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon icon={icon.icon} width={16} className="shrink-0" />
                                <span className="font-medium text-slate-700">{platformName}</span>
                              </div>
                              <span className="text-slate-500 font-semibold">
                                {formatFollowersShort(p.followers)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end gap-4 pt-2">
                        <button
                          onClick={() => {
                            setSelectedInfluencer(inf);
                            setSelectedContact({
                              whatsapp: inf.contacts || [],
                              email: inf.email || null,
                            });
                            setShowContactModal(true);
                          }}
                          className="text-green-600 text-sm font-semibold"
                        >
                          Hubungi
                        </button>

                        <button
                          onClick={() => {
                            setEditingInfluencer({
                              id: inf.id,
                              name: inf.name || "",
                              email: inf.email || "",
                              contacts: inf.contacts || [],
                              platforms: (inf.platforms || []).map((p) => ({
                                platform_id: p.id,
                                username: p.username,
                                followers: p.followers,
                              })),
                            });
                            setShowInfluencerModal(false);
                            setShowEditInfluencerModal(true);
                          }}
                          className="text-blue-600 text-sm font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PAGINATION */}
            <div className="border-t px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-sm text-slate-500">
                Halaman {infPage} dari {infTotalPage}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={infPage === 1}
                  onClick={() => setInfPage(infPage - 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Sebelumnya
                </button>

                <button
                  disabled={infPage === infTotalPage}
                  onClick={() => setInfPage(infPage + 1)}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL EDIT INFLUENCER (MOBILE FIX) ================= */}
      {showEditInfluencerModal && editingInfluencer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-blue-900">Edit Influencer</h3>
                  <p className="text-sm text-slate-500 mt-1">Perbarui data influencer</p>
                </div>
                <button
                  onClick={() => {
                    setShowEditInfluencerModal(false);
                    setShowInfluencerModal(true);
                  }}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <Icon icon="solar:close-circle-bold" width={26} />
                </button>
              </div>
            </div>

            {/* BODY scroll only here */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6">
                {/* LEFT */}
                <div className="space-y-4">
                  <div>
                    <label className="text-base font-semibold">
                      Nama Influencer <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded-lg px-4 py-3 mt-1 text-base"
                      value={editingInfluencer.name}
                      onChange={(e) => setEditingInfluencer((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-base font-semibold">Email (opsional)</label>
                    <input
                      className="w-full border rounded-lg px-4 py-3 mt-1 text-base"
                      value={editingInfluencer.email}
                      onChange={(e) => setEditingInfluencer((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-base font-semibold">Nomor Telepon (opsional)</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg px-4 py-3 mt-1 text-base"
                      value={Array.isArray(editingInfluencer.contacts) ? editingInfluencer.contacts.join(", ") : ""}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^0-9+,-\s]/g, "");
                        const parsed = sanitized
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean);
                        setEditingInfluencer((prev) => ({ ...prev, contacts: parsed }));
                      }}
                      placeholder="Contoh: 08xxxxxxxxx, +62xxxxxxxxxx"
                    />
                    <p className="text-base text-slate-600 mt-1">
                      Nomor akan otomatis disimpan sebagai WhatsApp (+62)
                    </p>
                  </div>

                  <div className="text-base text-red-600">
                    * Mohon lengkapi salah satu kontak: email atau nomor telepon
                  </div>
                </div>

                {/* DIVIDER */}
                <div className="hidden md:flex items-stretch">
                  <div className="w-px bg-slate-300"></div>
                </div>

                {/* RIGHT */}
                <div className="min-w-0 flex flex-col">
                  <div className="text-base font-semibold mb-3">Platform Influencer <span className="text-red-500">*</span></div>

                  <div className="space-y-3">
                    {platforms
                      .filter((p) => ["TikTok", "YouTube", "X", "Facebook", "Instagram"].includes(p.name))
                      .map((p) => {
                        const selected = (editingInfluencer.platforms || []).find((x) => x.platform_id === p.id);
                        const code = PLATFORM_NAME_TO_CODE[p.name] || "";
                        const pIcon = PLATFORM_ICON[code];

                        return (
                          <div key={p.id} className="border rounded-lg p-3">
                            <label className="flex items-center gap-2 font-medium text-base">
                              <input
                                type="checkbox"
                                checked={!!selected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditingInfluencer((prev) => ({
                                      ...prev,
                                      platforms: [
                                        ...(prev.platforms || []),
                                        { platform_id: p.id, username: "", followers: "" },
                                      ],
                                    }));
                                  } else {
                                    setEditingInfluencer((prev) => ({
                                      ...prev,
                                      platforms: (prev.platforms || []).filter((x) => x.platform_id !== p.id),
                                    }));
                                  }
                                }}
                              />
                              {pIcon && <Icon icon={pIcon.icon} width={18} className="shrink-0" />}
                              {p.name}
                            </label>

                            {selected && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                <input
                                  className="border rounded px-3 py-3 text-base w-full"
                                  placeholder="Username"
                                  value={selected.username}
                                  onChange={(e) => {
                                    setEditingInfluencer((prev) => ({
                                      ...prev,
                                      platforms: (prev.platforms || []).map((x) =>
                                        x.platform_id === p.id ? { ...x, username: e.target.value } : x
                                      ),
                                    }));
                                  }}
                                />

                                <input
                                  className="border rounded px-3 py-3 text-base w-full"
                                  placeholder="Followers"
                                  value={formatFollowersInput(selected.followers)}
                                  onChange={(e) => {
                                    setEditingInfluencer((prev) => ({
                                      ...prev,
                                      platforms: (prev.platforms || []).map((x) =>
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
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER fixed */}
            <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-3 bg-white">
              <button
                onClick={() => {
                  setShowEditInfluencerModal(false);
                  setShowInfluencerModal(true);
                }}
                className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                disabled={savingEditInfluencer}
                onClick={handleUpdateInfluencer}
                className="px-6 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800"
              >
                {savingEditInfluencer ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CONTACT MODAL ================= */}
      {showContactModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowContactModal(false)} />

          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-blue-900">Contact Person</h3>

            <p className="text-slate-600 mt-2 text-sm">
              Hubungi contact person untuk influencer
              <span className="font-semibold text-slate-800"> {selectedInfluencer?.name}</span>.
            </p>

            <div className="mt-5 space-y-3">
              {selectedContact?.whatsapp?.map((cp, idx) => (
                <a
                  key={`wa-${idx}`}
                  href={`https://wa.me/${String(cp).replace("+", "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-green-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Icon icon="logos:whatsapp-icon" width={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{cp}</div>
                      <div className="text-xs text-slate-500">WhatsApp</div>
                    </div>
                  </div>
                  <Icon icon="solar:arrow-right-outline" width={18} className="text-slate-400" />
                </a>
              ))}

              {selectedContact?.email && (
                <button
                  onClick={() => {
                    const email = selectedContact.email;
                    const subject = encodeURIComponent("Kerjasama Influencer");
                    const body = encodeURIComponent(
                      `Halo ${selectedInfluencer?.name},\n\nSaya ingin berdiskusi terkait kerjasama influencer.`
                    );

                    window.open(
                      `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`,
                      "_blank"
                    );
                  }}
                  className="w-full text-left flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-blue-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Icon icon="logos:google-gmail" width={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{selectedContact.email}</div>
                      <div className="text-xs text-slate-500">Email (Gmail)</div>
                    </div>
                  </div>
                  <Icon icon="solar:arrow-right-outline" width={18} className="text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= HELPER ========================= */
function hitungStatistik(data = []) {
  const result = {};
  data.forEach((item) => {
    const label = item.status?.label;
    if (!label) return;
    result[label] = (result[label] || 0) + 1;
  });
  return result;
}

function hasAds(item) {
  return item.ads?.some((ad) => ad.is_ads) ?? false;
}

function getTotalBudget(item) {
  const contentBudget = Number(item.budget_with_trashed?.budget_content || 0);
  const adsBudget =
    item.ads?.reduce((sum, ad) => sum + Number(ad.budget_ads || 0), 0) || 0;
  return contentBudget + adsBudget;
}

function getPlatformIcons(item) {
  if (!item.content_platforms?.length) return "-";

  const used = new Set();

  return item.content_platforms
    .map((cp, index) => {
      const platformName = cp.platform?.name;
      if (!platformName) return null;

      const code = PLATFORM_NAME_TO_CODE[platformName];
      if (!code || !PLATFORM_ICON[code]) return null;

      if (used.has(code)) return null;
      used.add(code);

      return (
        <div key={index} className="w-9 h-9 flex items-center justify-center rounded-md bg-slate-50">
          <Icon icon={PLATFORM_ICON[code].icon} className="max-w-[90%] max-h-[90%]" />
        </div>
      );
    })
    .filter(Boolean);
}

function getPlatformData(platforms = [], name) {
  if (!Array.isArray(platforms)) return null;
  return platforms.find((p) => (p.name || p.platform?.name || "").toLowerCase() === name.toLowerCase());
}

function getPlatformIcon(name) {
  switch (name) {
    case "TikTok":
      return { icon: "ic:baseline-tiktok", size: 22 };
    case "Instagram":
      return { icon: "skill-icons:instagram", size: 22 };
    case "YouTube":
      return { icon: "logos:youtube-icon", size: 22 };
    case "Facebook":
      return { icon: "logos:facebook", size: 22 };
    case "X":
    case "Twitter":
      return { icon: "ri:twitter-x-line", size: 22 };
    default:
      return { icon: "mdi:web", size: 22 };
  }
}

function formatFollowersShort(value) {
  if (!value) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";

  if (num >= 1_000_000) {
    return (num / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  }
  if (num >= 1_000) {
    return (num / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " rb";
  }
  return num.toLocaleString("id-ID");
}
