import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Icon } from "@iconify/react";
import axios from "../../../lib/axios";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/* =========================
   ICON MAPPING
========================= */
const getPlatformIcon = (name) => {
  switch (name.toLowerCase()) {
    case "youtube":
      return "logos:youtube-icon";
    case "tiktok":
      return "logos:tiktok-icon";
    case "instagram":
      return "skill-icons:instagram";
    case "facebook":
      return "logos:facebook";
    case "x":
      return "ri:twitter-x-line";
    default:
      return "mdi:web";
  }
};

const isMobile = window.innerWidth < 640;

const formatDateID = (rawDate, short = false) => {
  if (!rawDate) return "";
  let y, m, d;
  if (rawDate.includes("-")) {
    [y, m, d] = rawDate.split("-");
  } else {
    [d, m, y] = rawDate.split("/");
    y = y.length === 2 ? "20" + y : y;
  }
  return new Date(`${y}-${m}-${d}`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: short ? "short" : "long",
    year: "numeric",
  });
};

const toLocalDateString = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getWeekOfMonth = (dateStr) => {
  const day = new Date(dateStr).getDate();
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
};

export default function AnalyticContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contentPlanId = id;

  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartRaw, setChartRaw] = useState([]);
  const [reports, setReports] = useState({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [chartMeta, setChartMeta] = useState({
    status: "ready",
    message: null,
  });
  const [content, setContent] = useState(null);
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    views: "",
    likes: "",
  });
  const [errors, setErrors] = useState({
    start_date: "",
    end_date: "",
    views: "",
    likes: "",
  });
  const [reportPage, setReportPage] = useState(1);
  const [reportPerPage, setReportPerPage] = useState(5);

  const hasInvalidMetric = Boolean(errors.views) || Boolean(errors.likes) || Boolean(errors.start_date) || Boolean(errors.end_date);

  const [selectedContentType, setSelectedContentType] = useState("all");
  const [selectedContentPlatform, setSelectedContentPlatform] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedYear, setSelectedYear] = useState("all");

  /* =========================
     FETCH ANALYTICS
  ========================= */
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `/content-plans/${contentPlanId}/analytics`
      );
      setPlatforms(res.data.platforms_available || []);
      setChartRaw(Array.isArray(res.data.chart) ? res.data.chart : []);
      setReports(res.data.reports || {});
      setContent(res.data.content || null);
      setChartMeta(
        res.data.chart_meta || {
          status: "ready",
          message: null,
        }
      );
      if (res.data.platforms_available?.length > 0) {
        setSelectedPlatform(res.data.platforms_available[0].platform_id);
      }
    } catch (err) {
      console.error("Fetch analytics error:", err);
      toast.error("Gagal memuat data analitik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!contentPlanId) return;
    fetchAnalytics();
  }, [contentPlanId]);

  useEffect(() => {
    setReportPage(1);
  }, [selectedPlatform, reportPerPage]);

  /* =========================
     BLOCKED DATES (untuk Add)
  ========================= */
  const blockedDates = useMemo(() => {
    if (!selectedContentPlatform || !reports[selectedPlatform]) return [];
    const ct = Object.values(reports[selectedPlatform].content_types || {})
      .find(c => c.content_platform_id === selectedContentPlatform);
    if (!ct || !ct.data) return [];

    const dates = [];
    ct.data.forEach(d => {
      const start = new Date(d.start_date);
      const end = new Date(d.end_date);
      const current = new Date(start);
      while (current <= end) {
        dates.push({
          date: new Date(current),
          record_id: d.record_id
        });
        current.setDate(current.getDate() + 1);
      }
    });
    return dates;
  }, [selectedPlatform, selectedContentPlatform, reports]);

  const blockedRanges = useMemo(() => {
    if (!selectedContentPlatform || !reports[selectedPlatform]) return [];
    const ct = Object.values(reports[selectedPlatform].content_types || {})
      .find(c => c.content_platform_id === selectedContentPlatform);
    if (!ct || !ct.data) return [];

    return ct.data.map(d => ({
      start: new Date(d.start_date),
      end: new Date(d.end_date),
      record_id: d.record_id
    }));
  }, [selectedPlatform, selectedContentPlatform, reports]);

  /* =========================
     BLOCKED DATES (untuk Edit) - EXCLUDE DATA YANG SEDANG DIEDIT
  ========================= */
  const blockedDatesForEdit = useMemo(() => {
    if (!editData?.id || !selectedContentPlatform || !reports[selectedPlatform]) return [];

    const ct = Object.values(reports[selectedPlatform].content_types || {})
      .find(c => c.content_platform_id === selectedContentPlatform);
    if (!ct || !ct.data) return [];

    const dates = [];
    ct.data.forEach(d => {
      // 🔥 SKIP data yang sedang diedit
      if (d.record_id === editData.id) return;

      const start = new Date(d.start_date);
      const end = new Date(d.end_date);
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    });
    return dates;
  }, [editData?.id, selectedPlatform, selectedContentPlatform, reports]);

  /* =========================
     VALIDASI OVERLAP
  ========================= */
  const validateDateOverlap = (startDate, endDate, excludeRecordId = null) => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);

    const hasOverlap = blockedRanges.some(range => {
      if (excludeRecordId && range.record_id === excludeRecordId) {
        return false;
      }
      const rangeStart = range.start;
      const rangeEnd = range.end;
      return !(end < rangeStart || start > rangeEnd);
    });

    if (hasOverlap) {
      return "Periode tanggal ini bertabrakan dengan data yang sudah ada";
    }
    return "";
  };

  /* =========================
     AVAILABLE MONTHS & YEARS
  ========================= */
  const availableMonths = useMemo(() => {
    if (!selectedPlatform) return [];
    let filtered = chartRaw.filter(c => c.platform_id === selectedPlatform);
    if (selectedContentType !== "all") {
      filtered = filtered.filter(c => c.content_platform_id === Number(selectedContentType));
    }

    const months = new Set();
    filtered.forEach(item => {
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);

      while (cur <= last) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
        months.add(key);
        cur.setMonth(cur.getMonth() + 1);
      }
    });

    return Array.from(months).sort().map(m => {
      const [year, month] = m.split("-");
      return {
        value: m,
        label: new Date(year, Number(month) - 1).toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric"
        })
      };
    });
  }, [chartRaw, selectedPlatform, selectedContentType]);

  const availableYears = useMemo(() => {
    if (!selectedPlatform) return [];
    let filtered = chartRaw.filter(c => c.platform_id === selectedPlatform);
    if (selectedContentType !== "all") {
      filtered = filtered.filter(c => c.content_platform_id === Number(selectedContentType));
    }

    const years = new Set();
    filtered.forEach(item => {
      const date = new Date(item.start_date);
      years.add(date.getFullYear());
    });
    return Array.from(years).sort();
  }, [chartRaw, selectedPlatform, selectedContentType]);

  const rangeIntersectsMonth = (start, end, year, month) => {
    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    return rangeStart <= monthEnd && rangeEnd >= monthStart;
  };

  const chartData = useMemo(() => {
    if (!selectedPlatform) return { labels: [], views: [], likes: [] };
    let filtered = chartRaw.filter(c => c.platform_id === selectedPlatform);

    if (selectedContentType === "all") {
      if (selectedYear !== "all") {
        filtered = filtered.filter(item => {
          const d = new Date(item.end_date);
          return d.getFullYear() === Number(selectedYear);
        });
      }

      if (selectedMonth === "all") {
        const monthly = {};
        filtered.forEach(item => {
          const d = new Date(item.end_date);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          if (!monthly[key]) monthly[key] = { views: 0, likes: 0, date: d };
          monthly[key].views += Number(item.views);
          monthly[key].likes += Number(item.likes);
        });

        const sorted = Object.values(monthly).sort((a, b) => a.date - b.date);
        return {
          labels: sorted.map(m =>
            m.date.toLocaleDateString("id-ID", { month: "short", year: "numeric" })
          ),
          views: sorted.map(m => m.views),
          likes: sorted.map(m => m.likes),
        };
      }

      filtered = filtered.filter(item => {
        const d = new Date(item.end_date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === selectedMonth;
      });

      const weeks = [0, 0, 0, 0].map(() => ({ views: 0, likes: 0 }));
      filtered.forEach(item => {
        const w = getWeekOfMonth(item.end_date);
        weeks[w].views += Number(item.views);
        weeks[w].likes += Number(item.likes);
      });

      return {
        labels: ["Minggu ke-1", "Minggu ke-2", "Minggu ke-3", "Minggu ke-4"],
        views: weeks.map(w => w.views),
        likes: weeks.map(w => w.likes),
      };
    }

    filtered = filtered.filter(c => c.content_platform_id === Number(selectedContentType));

    if (selectedYear !== "all" || selectedMonth !== "all") {
      filtered = filtered.filter(item => {
        const start = new Date(item.start_date);
        const end = new Date(item.end_date);

        if (selectedYear !== "all") {
          const y = Number(selectedYear);
          if (start.getFullYear() > y || end.getFullYear() < y) return false;
        }

        if (selectedMonth !== "all") {
          const [y, m] = selectedMonth.split("-");
          const monthStart = new Date(Number(y), Number(m) - 1, 1);
          const monthEnd = new Date(Number(y), Number(m), 0);
          if (start > monthEnd || end < monthStart) return false;
        }

        return true;
      });
    }

    const sorted = [...filtered]
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    const formatRange = (start, end) => {
      const f = d => new Date(d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "2-digit"
      });
      return `${f(start)} - ${f(end)}`;
    };

    return {
      labels: sorted.map(item =>
        formatRange(item.start_date, item.end_date)
      ),
      views: sorted.map(item => Number(item.views)),
      likes: sorted.map(item => Number(item.likes)),
    };
  }, [chartRaw, selectedPlatform, selectedContentType, selectedMonth, selectedYear]);

  const isNotPosted = content && content.status_label?.trim().toLowerCase() !== "diposting";
  const isDisabled = isNotPosted;

  const validateInput = (name, value) => {
    if (!selectedContentPlatform || !form.start_date || !form.end_date) return "";

    const platformReport = reports[selectedPlatform];
    if (!platformReport) return "";

    const ct = Object.values(platformReport.content_types || {})
      .find(c => c.content_platform_id === selectedContentPlatform);
    if (!ct || !ct.data.length) return "";

    const newStart = new Date(form.start_date);
    const newEnd = new Date(form.end_date);

    const sorted = [...ct.data].sort(
      (a, b) => new Date(a.start_date) - new Date(b.start_date)
    );

    let prev = null;
    let next = null;
    for (let d of sorted) {
      const dStart = new Date(d.start_date);
      if (dStart < newStart) prev = d;
      if (dStart > newStart) { next = d; break; }
    }

    if (prev) {
      if (name === "views" && value < prev.views)
        return `Views tidak boleh lebih kecil dari ${prev.views} (periode sebelumnya)`;
      if (name === "likes" && value < prev.likes)
        return `Likes tidak boleh lebih kecil dari ${prev.likes} (periode sebelumnya)`;
    }

    if (next) {
      if (name === "views" && value > next.views)
        return `Views tidak boleh lebih besar dari ${next.views} (periode setelahnya)`;
      if (name === "likes" && value > next.likes)
        return `Likes tidak boleh lebih besar dari ${next.likes} (periode setelahnya)`;
    }

    return "";
  };

  const tableData = useMemo(() => {
    if (!reports[selectedPlatform]) return [];
    let data = Object.values(reports[selectedPlatform].content_types || {})
      .flatMap(ct =>
        ct.data.map(d => ({
          ...d,
          content_type_name: ct.content_type_name,
          link: ct.link,
          content_platform_id: ct.content_platform_id
        }))
      );

    if (selectedContentType !== "all") {
      data = data.filter(d => d.content_platform_id === Number(selectedContentType));
    }

    if (selectedYear !== "all") {
      data = data.filter(d => {
        const start = new Date(d.start_date);
        const end = new Date(d.end_date);
        const year = Number(selectedYear);
        return start.getFullYear() <= year && end.getFullYear() >= year;
      });
    }

    if (selectedMonth !== "all") {
      const [y, m] = selectedMonth.split("-");
      const year = Number(y);
      const month = Number(m) - 1;
      data = data.filter(d =>
        rangeIntersectsMonth(d.start_date, d.end_date, year, month)
      );
    }

    return [...data].sort((a, b) =>
      new Date(a.start_date) - new Date(b.start_date)
    );
  }, [reports, selectedPlatform, selectedContentType, selectedMonth, selectedYear]);

  const validateDateRange = (startDate, endDate, recordId = null) => {
    const errors = { start_date: "", end_date: "" };
    if (!startDate || !endDate) return errors;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      errors.end_date = "Tanggal akhir tidak boleh lebih awal dari tanggal mulai";
      return errors;
    }

    const overlapError = validateDateOverlap(startDate, endDate, recordId);
    if (overlapError) {
      errors.start_date = overlapError;
    }

    return errors;
  };

  useEffect(() => {
    if (!chartData || chartData.labels.length === 0) {
      setChartMeta({
        status: "empty",
        message: "Belum Ada Data",
      });
    } else {
      setChartMeta({
        status: "ready",
        message: null,
      });
    }
  }, [chartData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "views" || name === "likes") {
      const numericValue = value.replace(/\D/g, "");
      const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

      setForm((prev) => ({
        ...prev,
        [name]: formattedValue,
      }));

      const errorMsg = validateInput(name, Number(numericValue));
      setErrors((prev) => ({
        ...prev,
        [name]: errorMsg,
      }));
    } else if (name === "start_date" || name === "end_date") {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));

      setTimeout(() => {
        const newStartDate = name === "start_date" ? value : form.start_date;
        const newEndDate = name === "end_date" ? value : form.end_date;
        const dateErrors = validateDateRange(newStartDate, newEndDate);
        setErrors((prev) => ({
          ...prev,
          ...dateErrors,
        }));
      }, 0);
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEditChange = (name, value) => {
    if (name === "start_date" || name === "end_date") {
      setEditData(prev => ({
        ...prev,
        [name]: value
      }));

      setTimeout(() => {
        const newStartDate = name === "start_date" ? value : editData.start_date;
        const newEndDate = name === "end_date" ? value : editData.end_date;
        const dateErrors = validateDateRange(newStartDate, newEndDate, editData.id);
        setErrors(prev => ({
          ...prev,
          ...dateErrors,
        }));
      }, 0);
    } else {
      const numericValue = String(value).replace(/\D/g, "");
      setEditData(prev => ({
        ...prev,
        [name]: Number(numericValue)
      }));

      if (name === "views" || name === "likes") {
        setErrors(prev => ({ ...prev, [name]: "" }));
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedContentPlatform) {
      toast.error("Pilih tipe konten terlebih dahulu");
      return;
    }

    if (!form.start_date || !form.end_date || !form.views || !form.likes) {
      toast.error("Harap isi semua kolom");
      return;
    }

    const dateErrors = validateDateRange(form.start_date, form.end_date);
    if (dateErrors.start_date || dateErrors.end_date) {
      toast.error(dateErrors.start_date || dateErrors.end_date);
      return;
    }

    const views = Number(form.views.replace(/\./g, ""));
    const likes = Number(form.likes.replace(/\./g, ""));

    if (likes > views) {
      toast.error("Likes tidak boleh lebih besar dari Views");
      return;
    }

    const viewsError = validateInput("views", views);
    const likesError = validateInput("likes", likes);
    if (viewsError || likesError) {
      toast.error(viewsError || likesError);
      return;
    }

    try {
      await axios.post(
        `/content-plans/${contentPlanId}/analytics/record`,
        {
          content_platform_id: selectedContentPlatform,
          start_date: form.start_date,
          end_date: form.end_date,
          views: views,
          likes: likes,
        }
      );
      toast.success("Data berhasil ditambahkan");
      setForm({ start_date: "", end_date: "", views: "", likes: "" });
      setSelectedContentPlatform(null);
      setErrors({ start_date: "", end_date: "", views: "", likes: "" });
      fetchAnalytics();
    } catch (err) {
      console.error(err.response?.data);
      const errorMsg = err.response?.data?.message || "Gagal menyimpan data";
      toast.error(errorMsg);
    }
  };

  const getTrendDiff = (data, index, key) => {
    if (selectedContentType === "all") return null;
    if (index === 0) return null;

    const currentDelta = data[index][key] - data[index - 1][key];
    if (index === 1) {
      return {
        diff: currentDelta,
        isUp: currentDelta >= 0,
      };
    }

    const prevDelta = data[index - 1][key] - data[index - 2][key];
    return {
      diff: currentDelta,
      isUp: currentDelta >= prevDelta,
    };
  };

  const option = useMemo(() => {
    const isAllContentTypes = selectedContentType === "all";
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0f172a",
        borderRadius: 12,
        padding: [12, 16],
        textStyle: {
          color: "#e5e7eb",
          fontSize: 13,
          fontWeight: 500,
        },
        extraCssText: "box-shadow: 0 10px 25px rgba(0,0,0,0.35);",
        formatter: (params) => {
          const label = params[0].axisValue;
          let html = `
          <div style="margin-bottom:8px; font-weight:600; font-size:14px;">
            ${label}
          </div>
        `;
          params.forEach(p => {
            const dotColor = p.seriesName === "Views" ? "#ef4444" : "#3b82f6";
            html += `
            <div style="display:flex; align-items:center; gap:10px; margin:6px 0;">
              <span style="width:10px; height:10px; border-radius:50%; background:${dotColor}; display:inline-block;"></span>
              <span style="min-width:52px;">${p.seriesName}</span>
              <span style="font-weight:600; margin-left:auto;">
                ${Number(p.value).toLocaleString("id-ID")}
              </span>
            </div>
          `;
          });
          return html;
        }
      },
      grid: isMobile
        ? { left: 60, right: 20, top: 28, bottom: 60 }
        : { left: 76, right: 36, top: 44, bottom: 68 },
      xAxis: {
        type: "category",
        data: chartData.labels,
        boundaryGap: false,
        axisLabel: {
          color: "#28282B",
          margin: 22,
          padding: [8, 0, 0, 0],
          fontSize: 12,
          interval: 0,
          rotate: chartData.labels.length > 5 ? 45 : 0,
        },
        axisLine: {
          lineStyle: { color: "#e2e8f0" }
        }
      },
      yAxis: {
        type: "value",
        scale: true,
        minInterval: 1,
        axisLabel: {
          color: "#28282B",
          margin: 20,
          padding: [0, 10, 0, 0],
          fontSize: 12,
          formatter: (v) => {
            if (v >= 1_000_000) return v / 1_000_000 + "M";
            if (v >= 1_000) return v / 1_000 + "K";
            return v;
          },
        },
        splitLine: { lineStyle: { color: "#e5e7eb" } },
      },
      series: [
        {
          name: "Views",
          type: "line",
          smooth: true,
          data: chartData.views,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: true,
          lineStyle: { color: "#ef4444", width: 3 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(239,68,68,0.3)" },
                { offset: 1, color: "rgba(239,68,68,0.05)" }
              ]
            }
          },
          itemStyle: {
            color: "#ef4444",
            borderWidth: 2,
            borderColor: "#fff"
          }
        },
        {
          name: "Likes",
          type: "line",
          smooth: true,
          data: chartData.likes,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: true,
          lineStyle: { color: "#3b82f6", width: 3 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(59,130,246,0.3)" },
                { offset: 1, color: "rgba(59,130,246,0.05)" }
              ]
            }
          },
          itemStyle: {
            color: "#3b82f6",
            borderWidth: 2,
            borderColor: "#fff"
          }
        }
      ]
    };
  }, [chartData, selectedContentType, isMobile]);

  const activePlatform = useMemo(() => {
    return platforms.find(p => p.platform_id === selectedPlatform);
  }, [platforms, selectedPlatform]);

  const activeContentPlatform = useMemo(() => {
    if (!reports[selectedPlatform]) return null;
    if (!selectedContentPlatform) return null;
    return Object.values(reports[selectedPlatform].content_types || {}).find(
      ct => ct.content_platform_id === selectedContentPlatform
    );
  }, [reports, selectedPlatform, selectedContentPlatform]);

  const handleUpdate = async () => {
    if (!editData?.id) {
      toast.error("ID data tidak ditemukan");
      return;
    }

    const dateErrors = validateDateRange(editData.start_date, editData.end_date, editData.id);
    if (dateErrors.start_date || dateErrors.end_date) {
      toast.error(dateErrors.start_date || dateErrors.end_date);
      return;
    }

    if (Number(editData.likes) > Number(editData.views)) {
      toast.error("Likes tidak boleh lebih besar dari Views");
      return;
    }

    try {
      setSaving(true);
      await axios.put(
        `/content-plans/${contentPlanId}/analytics/record/${editData.id}`,
        {
          start_date: editData.start_date,
          end_date: editData.end_date,
          views: Number(editData.views),
          likes: Number(editData.likes),
        }
      );
      toast.success("Data berhasil diperbarui");
      setIsEditOpen(false);
      setErrors({ start_date: "", end_date: "", views: "", likes: "" });
      fetchAnalytics();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || "Gagal memperbarui data";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const contentTypes = useMemo(() => {
    if (!selectedPlatform || !reports[selectedPlatform]) return [];
    return Object.values(reports[selectedPlatform].content_types || {});
  }, [reports, selectedPlatform]);

  const reportData = useMemo(() => {
    if (!reports[selectedPlatform]) return [];
    const all = Object.values(reports[selectedPlatform].content_types || {}).flatMap(ct =>
      ct.data.map(d => ({
        ...d,
        content_type_name: ct.content_type_name,
        link: ct.link,
        content_platform_id: ct.content_platform_id,
      }))
    );
    return selectedContentType === "all"
      ? all
      : all.filter(d => d.content_platform_id === Number(selectedContentType));
  }, [reports, selectedPlatform, selectedContentType]);

  const paginatedReport = useMemo(() => {
    const start = (reportPage - 1) * reportPerPage;
    return tableData.slice(start, start + reportPerPage);
  }, [tableData, reportPage, reportPerPage]);

  const reportTotalPage = Math.max(1, Math.ceil(tableData.length / reportPerPage));

  const paginationNumbers = useMemo(() => {
    const total = reportTotalPage;
    const current = reportPage;
    const windowSize = 3;

    let start = Math.max(1, current - 1);
    let end = start + windowSize - 1;

    if (end > total) {
      end = total;
      start = Math.max(1, end - windowSize + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [reportPage, reportTotalPage]);


  if (content && isNotPosted) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center text-center gap-4 px-4">
        <Icon icon="mdi:chart-line" className="text-6xl text-slate-300" />
        <h2 className="text-2xl font-bold text-slate-700">Data Tidak Ditemukan</h2>
        <p className="text-slate-500 text-base max-w-md">
          Konten ini belum diposting sehingga belum memiliki data analitik
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-8 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-all duration-200"
        >
          Kembali
        </button>
      </div>
    );
  }

  if (loading) return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-10 shadow-2xl flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-200 rounded-full animate-spin border-t-blue-900"></div>
          <Icon icon="mdi:chart-bar" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-900 text-3xl" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-slate-800">Memuat Data</p>
          <p className="text-sm text-slate-500 mt-1">Mohon tunggu sebentar...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-all duration-200 hover:shadow-sm"
          >
            <Icon icon="mdi:arrow-left" className="text-xl" />
          </button>
          <div>
            <h3 className="font-bold text-xl text-slate-800">Analisis Konten</h3>
            {content?.title && (
              <p className="text-md font-bold text-blue-700 mt-0.5">{content.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedContentType}
            onChange={(e) => {
              setSelectedContentType(e.target.value);
              setSelectedMonth("all");
              setSelectedYear("all");
            }}
            className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Semua Konten</option>
            {contentTypes.map(ct => (
              <option key={ct.content_platform_id} value={ct.content_platform_id}>
                {ct.content_type_name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {platforms.map((p) => (
              <button
                key={p.platform_id}
                onClick={() => {
                  setSelectedPlatform(p.platform_id);
                  setSelectedMonth("all");
                  setSelectedYear("all");
                }}
                className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all duration-200
                  ${selectedPlatform === p.platform_id
                    ? "border-slate-700 bg-slate-50 shadow-md scale-105"
                    : "border-slate-300 opacity-60 hover:opacity-100 hover:border-slate-400"
                  }`}
              >
                <Icon icon={getPlatformIcon(p.platform_name)} className="text-2xl" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FILTER BULAN & TAHUN */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Filter:</span>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          disabled={availableMonths.length === 0}
          className="border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">Semua Bulan</option>
          {availableMonths.map(month => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          disabled={availableYears.length === 0}
          className="border border-slate-300 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="all">Semua Tahun</option>
          {availableYears.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {(selectedMonth !== "all" || selectedYear !== "all") && (
          <button
            onClick={() => {
              setSelectedMonth("all");
              setSelectedYear("all");
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all duration-200 flex items-center gap-2"
          >
            <Icon icon="mdi:close" />
            Reset Filter
          </button>
        )}
      </div>

      {/* CHART */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 p-6">
        {chartMeta.status === "empty" ? (
          <div className="h-[360px] flex flex-col items-center justify-center text-slate-500 gap-3">
            <Icon icon="mdi:chart-line-variant" className="text-6xl opacity-20" />
            <p className="text-sm">{chartMeta.message}</p>
          </div>
        ) : (
          <div className="w-full h-[280px] sm:h-[380px]">
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
              notMerge
              lazyUpdate
            />
          </div>
        )}
      </div>

      {/* INPUT */}
      <div
        className={`rounded-2xl border-2 p-6
          ${isDisabled
            ? "bg-slate-50 border-slate-200 opacity-60"
            : "bg-gradient-to-br from-blue-50 to-slate-50 border-blue-200"
          }`}
      >
        {activePlatform && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                <Icon icon={getPlatformIcon(activePlatform.platform_name)} className="text-2xl" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-800">
                  Tambah Data <span className="text-blue-900">{activePlatform.platform_name}</span>
                </h4>
                {activeContentPlatform && (
                  <p className="text-sm text-slate-600">{activeContentPlatform.content_type_name}</p>
                )}
              </div>
            </div>
            {activeContentPlatform?.link && (
              <a
                href={activeContentPlatform.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-700 hover:underline ml-12 inline-flex items-center gap-1"
              >
                <Icon icon="mdi:link-variant" />
                Lihat Konten
              </a>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Tipe Konten<span className="text-red-500">*</span></label>
            <select
              value={selectedContentPlatform || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedContentPlatform(value ? Number(value) : null);
                setForm({ start_date: "", end_date: "", views: "", likes: "" });
                setErrors({ start_date: "", end_date: "", views: "", likes: "" });
              }}
              disabled={isDisabled}
              className="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
            >
              <option value="">Pilih Tipe</option>
              {contentTypes.map(ct => (
                <option key={ct.content_platform_id} value={ct.content_platform_id}>
                  {ct.content_type_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Tanggal Mulai<span className="text-red-500">*</span>
            </label>

            {/* WAJIB relative */}
            <div className="relative w-full">
              <DatePicker
                selected={form.start_date ? new Date(form.start_date) : null}
                onChange={(date) => {
                  const dateStr = toLocalDateString(date);
                  setForm(prev => ({
                    ...prev,
                    start_date: dateStr,
                    end_date: ""
                  }));
                  setErrors(prev => ({ ...prev, start_date: "", end_date: "" }));
                }}
                excludeDates={blockedDates.map(d => d.date)}
                dateFormat="yyyy-MM-dd"
                placeholderText="Pilih tanggal mulai"
                disabled={!selectedContentPlatform || isDisabled}
                wrapperClassName="w-full"
                className={`
        w-full
        border-2 rounded-xl
        pl-4 pr-11 py-2.5
        focus:outline-none
        focus:ring-2 focus:ring-blue-500
        focus:border-transparent
        disabled:bg-slate-100
        ${errors.start_date ? "border-red-500" : "border-slate-300"}
      `}
              />

              {/* ICON */}
              <Icon
                icon="solar:calendar-linear"
                width={20}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>

            {errors.start_date && (
              <p className="text-xs text-red-600 mt-1">
                {errors.start_date}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Tanggal Akhir<span className="text-red-500">*</span>
            </label>

            {/* WAJIB relative */}
            <div className="relative w-full">
              <DatePicker
                selected={form.end_date ? new Date(form.end_date) : null}
                onChange={(date) => {
                  const dateStr = toLocalDateString(date);
                  setForm(prev => ({
                    ...prev,
                    end_date: dateStr
                  }));

                  setTimeout(() => {
                    const dateErrors = validateDateRange(form.start_date, dateStr);
                    setErrors(prev => ({
                      ...prev,
                      ...dateErrors,
                    }));
                  }, 0);
                }}
                excludeDates={blockedDates.map(d => d.date)}
                minDate={form.start_date ? new Date(form.start_date) : null}
                dateFormat="yyyy-MM-dd"
                placeholderText="Pilih tanggal akhir"
                disabled={!selectedContentPlatform || isDisabled || !form.start_date}
                wrapperClassName="w-full"
                className={`
        w-full
        border-2 rounded-xl
        pl-4 pr-11 py-2.5
        focus:outline-none
        focus:ring-2 focus:ring-blue-500
        focus:border-transparent
        disabled:bg-slate-100
        ${errors.end_date ? "border-red-500" : "border-slate-300"}
      `}
              />

              {/* ICON */}
              <Icon
                icon="solar:calendar-linear"
                width={20}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>

            {errors.end_date && (
              <p className="text-xs text-red-600 mt-1">
                {errors.end_date}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Jumlah Views<span className="text-red-500">*</span></label>
            <input
              type="text"
              name="views"
              disabled={isDisabled}
              className={`w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100
                ${errors.views ? "border-red-500" : "border-slate-300"}`}
              value={form.views}
              placeholder="0"
              onChange={handleChange}
            />
            {errors.views && (
              <p className="text-xs text-red-600 mt-1">{errors.views}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Jumlah Likes<span className="text-red-500">*</span></label>
            <input
              type="text"
              name="likes"
              disabled={isDisabled}
              className={`w-full border-2 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100
                ${errors.likes ? "border-red-500" : "border-slate-300"}`}
              value={form.likes}
              placeholder="0"
              onChange={handleChange}
            />
            {errors.likes && (
              <p className="text-xs text-red-600 mt-1">{errors.likes}</p>
            )}
          </div>
          <div className="md:col-span-1">
            <label className="text-sm font-semibold text-transparent mb-2 block">Action</label>
            <button
              disabled={isDisabled || hasInvalidMetric}
              onClick={handleSubmit}
              className="w-full h-[44px] bg-blue-900 text-white rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg"
            >
              Tambah Data
            </button>
          </div>
        </div>
        <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2 font-medium">
            <Icon icon="mdi:information-outline" />
            <span>Catatan:</span>
          </div>
          <ul className="list-disc pl-6 space-y-1">
            <li>Periode tanggal tidak boleh bertabrakan dengan data yang sudah ada</li>
            <li>Views dan Likes tidak boleh kurang dari data terakhir</li>
            <li>Likes tidak boleh lebih besar dari views</li>
          </ul>
        </div>
      </div>

      {/* TABLE REPORT */}
      {selectedPlatform && reports[selectedPlatform] && (
        <div className="rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 flex items-center justify-between border-b-2 border-slate-200">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg text-slate-800">
                Report – {reports[selectedPlatform].platform_name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600 font-medium">Tampilkan</span>
              <select
                value={reportPerPage}
                onChange={(e) => {
                  setReportPerPage(Number(e.target.value));
                  setReportPage(1);
                }}
                className="border-2 border-slate-300 rounded-lg px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="text-slate-600 font-medium">data</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-left font-bold text-slate-700">Periode</th>
                  <th className="px-5 py-3.5 text-left font-bold text-slate-700">Tipe Konten</th>
                  <th className="px-5 py-3.5 text-left font-bold text-slate-700">Views</th>
                  <th className="px-5 py-3.5 text-left font-bold text-slate-700">Likes</th>
                  <th className="px-3 py-3.5 text-center font-bold text-slate-700 w-[60px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReport.map((row, i) => {
                  const globalIndex = (reportPage - 1) * reportPerPage + i;
                  const viewsTrend = getTrendDiff(reportData, globalIndex, "views");
                  const likesTrend = getTrendDiff(reportData, globalIndex, "likes");
                  return (
                    <tr key={i} className="border-b border-slate-200 hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-5 py-4 text-left whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-700 text-xs">
                            {formatDateID(row.start_date, true)}
                          </span>
                          <span className="text-slate-500 text-xs">s/d</span>
                          <span className="font-medium text-slate-700 text-xs">
                            {formatDateID(row.end_date, true)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-left">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-slate-800">{row.content_type_name}</span>
                          {row.link && (
                            <a
                              href={row.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                            >
                              <Icon icon="mdi:link-variant" className="text-sm" />
                              Lihat Konten
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="font-semibold text-slate-800 whitespace-nowrap">
                            {row.views.toLocaleString("id-ID")}
                          </span>
                          {viewsTrend && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
                              ${viewsTrend.isUp
                                  ? "text-green-700 bg-green-100"
                                  : "text-red-700 bg-red-100"}`}
                            >
                              <Icon
                                icon={viewsTrend.isUp ? "mdi:arrow-up-bold" : "mdi:arrow-down-bold"}
                                className="text-sm"
                              />
                              {Math.abs(viewsTrend.diff).toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {row.likes.toLocaleString("id-ID")}
                          </span>
                          {likesTrend && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
                              ${likesTrend.isUp
                                  ? "text-green-700 bg-green-100"
                                  : "text-red-700 bg-red-100"}`}
                            >
                              <Icon
                                icon={likesTrend.isUp ? "mdi:arrow-up-bold" : "mdi:arrow-down-bold"}
                                className="text-sm"
                              />
                              {Math.abs(likesTrend.diff).toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center">
                        <button
                          onClick={() => {
                            setEditData({
                              id: row.record_id,
                              start_date: row.start_date,
                              end_date: row.end_date,
                              views: row.views,
                              likes: row.likes,
                              content_platform_id: row.content_platform_id
                            });
                            setSelectedContentPlatform(row.content_platform_id);
                            setErrors({ start_date: "", end_date: "", views: "", likes: "" });
                            setIsEditOpen(true);
                          }}
                          className="p-2.5 rounded-xl hover:bg-slate-200 transition-all duration-200 hover:shadow-sm inline-flex items-center justify-center"
                          title="Edit data"
                        >
                          <Icon icon="solar:pen-outline" width={20} className="text-slate-600" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="h-32 text-center align-middle">
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-slate-500 font-medium">Belum Ada Data</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {reportTotalPage > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t-2 border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-600 font-medium">
                Halaman {reportPage} dari {reportTotalPage}
              </span>

              <div className="flex gap-2">
                {/* PREV */}
                <button
                  disabled={reportPage === 1}
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 border-2 border-slate-300 rounded-lg font-medium text-slate-700
          disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all duration-200"
                >
                  Sebelumnya
                </button>

                {/* PAGE NUMBERS (WINDOW 3) */}
                {paginationNumbers.map((p) => (
                  <button
                    key={p}
                    onClick={() => setReportPage(p)}
                    className={`px-4 py-2 border-2 rounded-lg font-medium transition-all duration-200
            ${p === reportPage
                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                        : "border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                  >
                    {p}
                  </button>
                ))}

                {/* NEXT */}
                <button
                  disabled={reportPage === reportTotalPage}
                  onClick={() => setReportPage((p) => Math.min(reportTotalPage, p + 1))}
                  className="px-4 py-2 border-2 border-slate-300 rounded-lg font-medium text-slate-700
          disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-all duration-200"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ================= MODAL EDIT ================= */}
      {isEditOpen && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsEditOpen(false)}
          />

          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl z-10 flex flex-col max-h-[90vh]">

            <div className="px-6 pt-6 pb-4 border-b border-slate-200">
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setErrors({ start_date: "", end_date: "", views: "", likes: "" });
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <Icon icon="mdi:close" width={22} />
              </button>

              <h2 className="text-3xl font-bold text-blue-900">
                Edit Data
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Perbarui data analitik konten Anda
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              <div className="w-full">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Tanggal Mulai
                </label>

                <div className="relative w-full">
                  <DatePicker
                    selected={editData.start_date ? new Date(editData.start_date) : null}
                    onChange={(date) =>
                      handleEditChange("start_date", toLocalDateString(date))
                    }
                    excludeDates={blockedDatesForEdit}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Pilih tanggal mulai"
                    wrapperClassName="w-full"
                    className={`
                w-full
                border rounded-lg
                pl-4 pr-11 py-2.5
                text-sm
                focus:outline-none
                focus:ring-2 focus:ring-blue-500
                ${errors.start_date
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"}
              `}
                  />

                  <Icon
                    icon="solar:calendar-linear"
                    width={20}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>

                {errors.start_date && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.start_date}
                  </p>
                )}
              </div>

              <div className="w-full">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Tanggal Akhir
                </label>

                <div className="relative w-full">
                  <DatePicker
                    selected={editData.end_date ? new Date(editData.end_date) : null}
                    onChange={(date) =>
                      handleEditChange("end_date", toLocalDateString(date))
                    }
                    excludeDates={blockedDatesForEdit}
                    minDate={editData.start_date ? new Date(editData.start_date) : null}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Pilih tanggal akhir"
                    wrapperClassName="w-full"
                    className={`
                w-full
                border rounded-lg
                pl-4 pr-11 py-2.5
                text-sm
                focus:outline-none
                focus:ring-2 focus:ring-blue-500
                ${errors.end_date
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"}
              `}
                  />

                  <Icon
                    icon="solar:calendar-linear"
                    width={20}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>

                {errors.end_date && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.end_date}
                  </p>
                )}
              </div>

              <div className="w-full">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Jumlah Views
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={Number(editData.views).toLocaleString("id-ID")}
                    onChange={(e) =>
                      handleEditChange("views", e.target.value.replace(/\D/g, ""))
                    }
                    className={`
                w-full
                border rounded-lg
                pl-4 pr-11 py-2.5
                text-sm
                focus:outline-none
                focus:ring-2 focus:ring-blue-500
                ${errors.views
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"}
              `}
                  />
                </div>

                {errors.views && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.views}
                  </p>
                )}
              </div>

              <div className="w-full">
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Jumlah Likes
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={Number(editData.likes).toLocaleString("id-ID")}
                    onChange={(e) =>
                      handleEditChange("likes", e.target.value.replace(/\D/g, ""))
                    }
                    className={`
                w-full
                border rounded-lg
                pl-4 pr-11 py-2.5
                text-sm
                focus:outline-none
                focus:ring-2 focus:ring-blue-500
                ${errors.likes
                        ? "border-red-500 bg-red-50"
                        : "border-slate-300"}
              `}
                  />

                </div>

                {errors.likes && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.likes}
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-slate-200 space-y-3">
              <button
                disabled={saving || hasInvalidMetric}
                onClick={handleUpdate}
                className={`
            w-full py-3 rounded-lg font-medium text-white transition-colors
            ${saving || hasInvalidMetric
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-900 hover:bg-blue-800"}
          `}
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>

              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setErrors({ start_date: "", end_date: "", views: "", likes: "" });
                }}
                className="w-full py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
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