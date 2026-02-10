import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import ReactECharts from "echarts-for-react";
import api from "../lib/axios";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import VisitMap from "../components/maps/VisitMap";

// =========================================================================
// 1. KOMPONEN ANIMASI ANGKA
// =========================================================================
const AnimateNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let startTime;
    const duration = 1500;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplayValue(Math.floor(progress * value));
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [value]);
  return <span>{displayValue.toLocaleString("id-ID")}</span>;
};

// =========================================================================
// 2. DATA MENU
// =========================================================================
const quickMenus = [
  {
    title: "Data Koordinator",
    desc: "Kelola data koordinator",
    icon: "solar:user-id-bold",
    path: "/koordinator/kunjungan",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Data Relawan",
    desc: "Kelola data relawan",
    icon: "solar:users-group-rounded-bold",
    path: "/relawan",
    gradient: "from-green-500 to-green-600",
  },
  {
    title: "Konten",
    desc: "Kelola Jadwal Konten",
    icon: "uil:schedule",
    path: "/konten",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    title: "Suara",
    desc: "Analisis Suara",
    icon: "solar:chart-bold",
    path: "/suara/analisis",
    gradient: "from-orange-500 to-orange-600",
  },
];

// Platform config
const platformConfig = {
  TikTok: { icon: "ic:baseline-tiktok", color: "#000000" },
  Instagram: { icon: "skill-icons:instagram", color: "#E1306C" },
  YouTube: { icon: "logos:youtube-icon", color: "#FF0000" },
  Facebook: { icon: "logos:facebook", color: "#1877F2" },
  X: { icon: "ri:twitter-x-line", color: "rgb(83, 84, 88)" },
};

function formatRoleLabel(role = "") {
  return role
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role") || "Admin";

  // ✅ Refs untuk ECharts instances
  const barChartRef = useRef(null);
  const stackedChartRef = useRef(null);
  const pieChartRef = useRef(null);
  const progressChartRef = useRef(null);

  const [summary, setSummary] = useState({ koordinator_total: 0, relawan_total: 0 });
  const [barOption, setBarOption] = useState({});
  const [stackedOption, setStackedOption] = useState({});
  const [stackedData, setStackedData] = useState([]);

  const [contentSummary, setContentSummary] = useState({
    per_platform: [
      { platform: "TikTok", total: 0 },
      { platform: "Instagram", total: 0 },
      { platform: "YouTube", total: 0 },
      { platform: "Facebook", total: 0 },
      { platform: "X", total: 0 },
    ],
    comparison: { target: 0, posted: 0 },
  });

  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [visitSummary, setVisitSummary] = useState(null);
  const [harapanList, setHarapanList] = useState([]);
  const [visitPieOption, setVisitPieOption] = useState({});

  const [progressData, setProgressData] = useState([]);
  const [progressOption, setProgressOption] = useState({});

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // =========================================================================
  // ✅ RESIZE HANDLER untuk semua charts
  // =========================================================================
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);

      // Resize semua chart instances
      setTimeout(() => {
        if (barChartRef.current) {
          const instance = barChartRef.current.getEchartsInstance();
          instance.resize();
        }
        if (stackedChartRef.current) {
          const instance = stackedChartRef.current.getEchartsInstance();
          instance.resize();
        }
        if (pieChartRef.current) {
          const instance = pieChartRef.current.getEchartsInstance();
          instance.resize();
        }
        if (progressChartRef.current) {
          const instance = progressChartRef.current.getEchartsInstance();
          instance.resize();
        }
      }, 100);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // =========================================================================
  // INIT DATA
  // =========================================================================
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    setIsLoading(true);

    Promise.allSettled([
      api.get("/dashboard"),
      api.get("/peta/kunjungan"),
      Promise.resolve({ data: { success: true, data: [] } }),
      api.get("/dashboard/visit-summary"),
      api.get("/dashboard/progress-bar"),
    ])
      .then(([resSummary, resVisits, _resDummy, resVisitSummary, resProgress]) => {
        if (resSummary.status === "fulfilled" && resSummary.value?.data?.success) {
          const data = resSummary.value.data.data;
          setSummary(data || { koordinator_total: 0, relawan_total: 0 });
          if (data?.content_summary) setContentSummary(data.content_summary);
        }

        if (resVisits.status === "fulfilled" && resVisits.value?.data?.success) {
          setVisits(resVisits.value.data.data || []);
        }

        if (resVisitSummary.status === "fulfilled" && resVisitSummary.value?.data?.success) {
          const data = resVisitSummary.value.data.data;
          setVisitSummary(data?.pie || null);
          setHarapanList(data?.harapan || []);
        }

        if (resProgress.status === "fulfilled" && resProgress.value?.data?.success) {
          setProgressData(resProgress.value.data.data || []);
        }
      })
      .finally(() => setIsLoading(false));
  }, [navigate]);

  // =========================================================================
  // Build ECharts bar option
  // =========================================================================
  useEffect(() => {
    const sorted = [...contentSummary.per_platform].sort((a, b) => b.total - a.total);

    setBarOption({
      grid: {
        left: isMobile ? 40 : isTablet ? 50 : 60,
        right: isMobile ? 40 : isTablet ? 55 : 70,
        top: isMobile ? 20 : 30,
        bottom: isMobile ? 20 : 30,
      },
      xAxis: {
        type: "value",
        axisLabel: {
          color: "#64748b",
          fontSize: isMobile ? 9 : isTablet ? 10 : 12,
        },
        splitLine: { lineStyle: { type: "dashed", color: "#e2e8f0" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: sorted.map((i) => i.platform),
        axisLabel: {
          color: "#334155",
          fontWeight: "600",
          fontSize: isMobile ? 10 : isTablet ? 11 : 13,
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: "bar",
          data: sorted.map((i) => ({
            value: i.total,
            itemStyle: {
              color: platformConfig[i.platform]?.color || "#6b7280",
              borderRadius: [0, 10, 10, 0],
            },
          })),
          barWidth: isMobile ? 16 : isTablet ? 20 : 26,
          label: {
            show: true,
            position: "right",
            color: "#0f172a",
            fontWeight: "bold",
            fontSize: isMobile ? 10 : isTablet ? 11 : 14,
          },
          animationDuration: 1000,
          animationEasing: "elasticOut",
        },
      ],
    });
  }, [contentSummary.per_platform, isMobile, isTablet]);

  // =========================================================================
  // Stacked bar chart - WARNA BIRU BERTINGKAT
  // =========================================================================
  useEffect(() => {
    api
      .get("/dashboard/stacked-bar")
      .then((res) => {
        if (!res.data.success) return;
        const data = res.data.data || [];
        setStackedData(data);

        setStackedOption({
          tooltip: { show: false },
          legend: {
            data: ["Sangat Tidak Setuju", "Tidak Setuju", "Setuju", "Sangat Setuju"],
            top: isMobile ? 0 : undefined,
            bottom: isMobile ? undefined : 20,
            itemWidth: isMobile ? 10 : isTablet ? 12 : 16,
            itemHeight: isMobile ? 10 : isTablet ? 12 : 16,
            itemGap: isMobile ? 6 : isTablet ? 10 : 24,
            icon: "roundRect",
            textStyle: {
              color: "#475569",
              fontSize: isMobile ? 8 : isTablet ? 10 : 13,
              fontWeight: 600,
            },
          },
          grid: {
            left: 10,
            right: isMobile ? 30 : isTablet ? 30 : 30,
            top: isMobile ? 30 : isTablet ? 40 : 50,
            bottom: isMobile ? 50 : isTablet ? 65 : 80,
          },
          xAxis: {
            type: "value",
            max: 100,
            interval: 25,
            axisLabel: {
              formatter: "{value}%",
              color: "#64748b",
              fontSize: isMobile ? 8 : isTablet ? 10 : 13,
              fontWeight: 600,
            },
            splitLine: { lineStyle: { type: "dashed", color: "#e2e8f0", width: 1.5 } },
            axisLine: { lineStyle: { color: "#cbd5e1", width: 2 } },
            axisTick: { show: false },
          },
          yAxis: {
            type: "category",
            inverse: true,
            data: data.map(() => ""),
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: { show: false },
          },
          series: [
            {
              name: "Sangat Tidak Setuju",
              type: "bar",
              stack: "total",
              barWidth: isMobile ? "40%" : isTablet ? "50%" : "65%",
              itemStyle: {
                color: "#00319c", // Biru sangat gelap
                borderRadius: [6, 0, 0, 6],
              },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 7 : isTablet ? 9 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 15 : 8)) return "";
                  return isMobile
                    ? `${params.data.count}\n${params.data.percent}%`
                    : `${params.data.count} orang\n(${params.data.percent}%)`;
                },
              },
              data: data.map((d) => ({
                value: d.percents?.[1] || 0,
                count: d.counts?.[1] || 0,
                percent: d.percents?.[1] || 0,
              })),
            },
            {
              name: "Tidak Setuju",
              type: "bar",
              stack: "total",
              itemStyle: { 
                color: "#1754da", // Biru gelap
              },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 7 : isTablet ? 9 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 15 : 8)) return "";
                  return isMobile
                    ? `${params.data.count}\n${params.data.percent}%`
                    : `${params.data.count} orang\n(${params.data.percent}%)`;
                },
              },
              data: data.map((d) => ({
                value: d.percents?.[2] || 0,
                count: d.counts?.[2] || 0,
                percent: d.percents?.[2] || 0,
              })),
            },
            {
              name: "Setuju",
              type: "bar",
              stack: "total",
              itemStyle: { 
                color: "#3d7fea", // Biru medium
              },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 7 : isTablet ? 9 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 15 : 8)) return "";
                  return isMobile
                    ? `${params.data.count}\n${params.data.percent}%`
                    : `${params.data.count} orang\n(${params.data.percent}%)`;
                },
              },
              data: data.map((d) => ({
                value: d.percents?.[3] || 0,
                count: d.counts?.[3] || 0,
                percent: d.percents?.[3] || 0,
              })),
            },
            {
              name: "Sangat Setuju",
              type: "bar",
              stack: "total",
              itemStyle: { 
                color: "#7cacf8", // Biru terang
                borderRadius: [0, 6, 6, 0],
              },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 7 : isTablet ? 9 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 15 : 8)) return "";
                  return isMobile
                    ? `${params.data.count}\n${params.data.percent}%`
                    : `${params.data.count} orang\n(${params.data.percent}%)`;
                },
              },
              data: data.map((d) => ({
                value: d.percents?.[4] || 0,
                count: d.counts?.[4] || 0,
                percent: d.percents?.[4] || 0,
              })),
            },
          ],
          animationDuration: 1000,
          animationEasing: "cubicOut",
          animationDelay: (idx) => idx * 50,
        });
      })
      .catch(() => { });
  }, [isMobile, isTablet]);

  // =========================================================================
  // Pie chart - IMPROVED
  // =========================================================================
  useEffect(() => {
    if (!visitSummary) return;
    setVisitPieOption({
      tooltip: {
        show: true,
        trigger: "item",
        confine: true, // biar ga keluar card
        backgroundColor: "rgba(255,255,255,0.98)",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 12],
        extraCssText:
          "border-radius:12px; box-shadow:0 10px 30px rgba(2,6,23,.12);",
        textStyle: {
          color: "#0f172a",
          fontSize: isMobile ? 11 : 12,
        },
        formatter: (p) => {
          const val = (p?.value ?? 0).toLocaleString("id-ID");
          const percent = `${p?.percent ?? 0}%`;
          const name = p?.name ?? "-";
          const marker = p?.marker ?? "";

          return `
      <div style="min-width:180px">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px; font-weight:700;">
            ${marker}
            <span>${name}</span>
          </div>
          <span style="font-weight:800; color:#0f172a">${percent}</span>
        </div>
        <div style="margin-top:6px; height:1px; background:#e2e8f0;"></div>
        <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#64748b; font-size:11px;">Total</span>
          <span style="font-weight:800; color:#0f172a">${val} orang</span>
        </div>
      </div>
    `;
        },
      },
      legend: {
        bottom: isMobile ? 5 : isTablet ? 8 : 10,
        itemGap: isMobile ? 6 : isTablet ? 8 : 12,
        itemWidth: isMobile ? 10 : isTablet ? 12 : 14,
        itemHeight: isMobile ? 10 : isTablet ? 12 : 14,
        icon: "circle",
        textStyle: {
          fontSize: isMobile ? 9 : isTablet ? 10 : 11,
          color: "#475569",
        },
      },
      series: [
        {
          type: "pie",
          radius: isMobile ? "55%" : isTablet ? "60%" : "65%",
          center: ["50%", isMobile ? "38%" : isTablet ? "40%" : "42%"],
          data: (visitSummary.series || []).map((i) => ({
            name: i.name,
            value: i.value,
            itemStyle: {
              borderRadius: 6,
              borderColor: "#fff",
              borderWidth: 3,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.3)",
              },
              label: {
                show: true,
                fontSize: isMobile ? 11 : isTablet ? 12 : 14,
                fontWeight: "bold",
              },
            },
          })),
          label: {
            show: true,
            position: "outside",
            formatter: (params) => {
              return isMobile
                ? `${params.name}\n${params.percent}%`
                : `${params.name}\n${params.percent}% (${params.value} orang)`;
            },
            fontSize: isMobile ? 8 : isTablet ? 9 : 10,
            fontWeight: "600",
            color: "#334155",
            lineHeight: isMobile ? 11 : isTablet ? 13 : 16,
          },
          labelLine: {
            show: true,
            length: isMobile ? 5 : isTablet ? 8 : 12,
            length2: isMobile ? 5 : isTablet ? 8 : 12,
            smooth: true,
          },
          animationType: "scale",
          animationEasing: "elasticOut",
          animationDelay: (idx) => idx * 100,
        },
      ],
      color: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"],
    });
  }, [visitSummary, isMobile, isTablet]);

  // =========================================================================
  // Progress bar chart - IMPROVED
  // =========================================================================
  useEffect(() => {
    if (!progressData.length) return;

    const labels = progressData.map((i) =>
      (i.question || "").replaceAll("_", " ").toUpperCase()
    );

    setProgressOption({
      grid: {
        left: isMobile ? 110 : isTablet ? 150 : 190, // ✅ ruang buat label yAxis
        right: isMobile ? 18 : 40,
        top: 18,
        bottom: 18,
        containLabel: false,
      },
      xAxis: {
        type: "value",
        max: 100,
        interval: isMobile ? 50 : 25, // ✅ biar ga numpuk
        axisLabel: {
          formatter: "{value}%",
          color: "#64748b",
          fontSize: isMobile ? 9 : isTablet ? 10 : 11,
        },
        splitLine: { lineStyle: { type: "dashed", color: "#e2e8f0" } },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#334155",
          fontWeight: 700,
          fontSize: isMobile ? 9 : isTablet ? 10 : 11,
          width: isMobile ? 95 : isTablet ? 135 : 165,
          overflow: "truncate",
          lineHeight: 14,
        },
      },
      series: [
        {
          type: "bar",
          barWidth: isMobile ? 14 : isTablet ? 16 : 20,
          data: progressData.map((i) => ({
            value: i.percent_positive || 0,
            labelText: isMobile
              ? `${i.percent_positive || 0}%`
              : `${i.percent_positive || 0}% (${i.positive_count || 0}/${i.total_count || 0})`,
          })),
          itemStyle: { color: "#2563EB", borderRadius: [0, 8, 8, 0] },
          label: {
            show: true,
            position: "right",
            formatter: (p) => p.data.labelText,
            color: "#0f172a",
            fontWeight: "bold",
            fontSize: isMobile ? 9 : isTablet ? 10 : 12,
            padding: [0, 0, 0, 6],
          },
          animationDuration: 900,
          animationEasing: "cubicOut",
        },
      ],
    });
  }, [progressData, isMobile, isTablet]);

  return (
    <div className="min-h-screen w-full space-y-4 sm:space-y-5 md:space-y-6 animate-in fade-in duration-500 p-3 sm:p-4 md:p-6 lg:p-8">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white rounded-xl md:rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-36 sm:h-36 md:w-48 md:h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Icon icon="solar:home-2-bold" width={isMobile ? 20 : isTablet ? 24 : 28} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Selamat Datang, {formatRoleLabel(role)}</h1>
              <p className="text-xs sm:text-sm md:text-base text-blue-100 mt-0.5 sm:mt-1">Sistem Manajemen SuperWeb</p>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        {isLoading ? (
          <>
            <div className="h-28 sm:h-32 md:h-36 lg:h-40 bg-slate-100 animate-pulse rounded-xl md:rounded-2xl" />
            <div className="h-28 sm:h-32 md:h-36 lg:h-40 bg-slate-100 animate-pulse rounded-xl md:rounded-2xl" />
          </>
        ) : (
          <>
            <div className="group bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 text-white p-4 sm:p-5 md:p-6 lg:p-8 rounded-xl md:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-1 sm:mb-2">
                    <AnimateNumber value={summary.koordinator_total || 0} />
                  </div>
                  <div className="text-xs sm:text-sm md:text-base text-blue-100 font-medium">
                    Total Koordinator
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <Icon icon="solar:user-id-bold" width={isMobile ? 24 : isTablet ? 28 : 32} />
                </div>
              </div>
            </div>

            <div className="group bg-gradient-to-br from-green-600 via-green-500 to-green-400 text-white p-4 sm:p-5 md:p-6 lg:p-8 rounded-xl md:rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-1 sm:mb-2">
                    <AnimateNumber value={summary.relawan_total || 0} />
                  </div>
                  <div className="text-xs sm:text-sm md:text-base text-green-100 font-medium">
                    Total Relawan
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <Icon icon="solar:users-group-rounded-bold" width={isMobile ? 24 : isTablet ? 28 : 32} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* QUICK ACCESS */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 sm:p-5 md:p-6 lg:p-8 border border-slate-100">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 md:mb-6">
          <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon icon="solar:widget-4-bold" className="text-blue-600" width={isMobile ? 18 : isTablet ? 20 : 22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800">Akses Cepat</h2>
            <p className="text-xs sm:text-sm text-slate-500">Navigasi cepat ke fitur utama sistem</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {quickMenus.map((m) => (
            <div
              key={m.title}
              onClick={() => navigate(m.path)}
              className="group cursor-pointer rounded-xl border-2 border-slate-100 p-3 sm:p-4 md:p-5 hover:border-transparent hover:shadow-lg transition-all duration-300 relative overflow-hidden bg-white"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className="flex flex-col items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon icon={m.icon} width={isMobile ? 18 : isTablet ? 20 : 24} />
                  </div>
                  <div className="flex-1 w-full">
                    <div className="font-bold text-sm sm:text-base text-slate-800 group-hover:text-white transition-colors mb-1">{m.title}</div>
                    <div className="text-xs sm:text-sm text-slate-500 group-hover:text-white/80 transition-colors line-clamp-2">{m.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-blue-600 group-hover:text-white transition-colors">
                  <span>Buka</span>
                  <Icon icon="solar:arrow-right-linear" width={isMobile ? 14 : 18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 sm:p-5 md:p-6 border border-slate-100">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Icon icon="solar:document-text-bold" className="text-purple-600" width={isMobile ? 18 : isTablet ? 20 : 22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800">Resume Konten</h2>
              <p className="text-xs sm:text-sm text-slate-500">Jumlah konten yang telah diposting</p>
            </div>
          </div>

          <div className="h-[220px] sm:h-[260px] md:h-[300px] mt-3 sm:mt-4">
            <ReactECharts
              ref={barChartRef}
              option={barOption}
              notMerge
              lazyUpdate
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 text-white p-4 sm:p-6 md:p-8 rounded-xl md:rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-6 sm:mb-7 md:mb-8">
              <div>
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">
                  <AnimateNumber value={contentSummary.comparison.posted || 0} /> / <AnimateNumber value={contentSummary.comparison.target || 0} />
                </div>
                <div className="text-xs sm:text-sm md:text-base text-blue-100 font-medium">Total Postingan Konten</div>
              </div>
              <div className="w-12 h-12 sm:w-13 sm:h-13 md:w-14 md:h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon icon="solar:chart-2-bold" width={isMobile ? 24 : isTablet ? 26 : 28} />
              </div>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2 font-medium">
                  <span className="text-blue-100">Target</span>
                  <span>{contentSummary.comparison.target || 0}</span>
                </div>
                <div className="h-2.5 sm:h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div className="h-full rounded-full bg-white/50 transition-all duration-1000" style={{ width: "100%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2 font-medium">
                  <span className="text-blue-100">Posted</span>
                  <span>{contentSummary.comparison.posted || 0}</span>
                </div>
                <div className="h-2.5 sm:h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full rounded-full bg-white shadow-lg transition-all duration-1000"
                    style={{
                      width: `${(contentSummary.comparison.target || 0) > 0
                        ? ((contentSummary.comparison.posted || 0) / (contentSummary.comparison.target || 0)) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-center pt-3 sm:pt-4 border-t border-white/20">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1">
                  {(contentSummary.comparison.target || 0) > 0
                    ? Math.round(((contentSummary.comparison.posted || 0) / (contentSummary.comparison.target || 0)) * 100)
                    : 0}
                  %
                </div>
                <div className="text-xs sm:text-sm text-blue-100 font-medium">Tercapai dari Target</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SURVEY CHART */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 sm:p-5 md:p-6 border border-slate-100">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Icon icon="solar:chart-square-bold" className="text-orange-600" width={isMobile ? 18 : isTablet ? 20 : 22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-slate-800">Resume Survey</h2>
            <p className="text-xs sm:text-sm text-slate-500">Distribusi jawaban responden untuk tiap pertanyaan</p>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 md:gap-4 h-[350px] sm:h-[420px] md:h-[500px] mt-3 sm:mt-4">
          <div className="flex flex-col justify-around py-10 sm:py-12 md:py-16">
            {stackedData.map((item, idx) => {
              const label = item.question || "";
              const words = label.split(" ");
              const mid = Math.ceil(words.length / 2);
              const line1 = words.slice(0, mid).join(" ");
              const line2 = words.slice(mid).join(" ");

              return (
                <div
                  key={idx}
                  className="text-[9px] sm:text-[11px] md:text-[13px] font-bold text-slate-800 leading-tight text-left"
                  style={{ minWidth: isMobile ? "80px" : isTablet ? "120px" : "160px" }}
                >
                  <div>{line1}</div>
                  <div>{line2 || "\u00A0"}</div>
                </div>
              );
            })}
          </div>

          <div className="flex-1">
            <ReactECharts
              ref={stackedChartRef}
              option={stackedOption}
              notMerge
              lazyUpdate
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        </div>
      </div>

      {/* ANALISIS CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon icon="solar:chart-2-bold" className="text-blue-600" width={20} />
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-slate-800 leading-tight">
                    Persentase Dukungan
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Persentase jawaban positif per indikator
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 md:p-5">
            {!progressData?.length ? (
              <div className="h-[260px] sm:h-[300px] md:h-[340px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <Icon icon="solar:chart-bold" width={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Belum ada data dukungan</p>
                </div>
              </div>
            ) : (
              <div className="h-[260px] sm:h-[300px] md:h-[340px] rounded-xl border border-slate-100 overflow-hidden">
                <ReactECharts
                  ref={progressChartRef}
                  option={progressOption}
                  notMerge
                  lazyUpdate
                  style={{ height: "100%", width: "100%" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Status Kunjungan */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Icon icon="solar:pie-chart-2-bold" className="text-emerald-600" width={isMobile ? 18 : 20} />
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-slate-800 leading-tight">
                    Status Kunjungan
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Distribusi status kunjungan oleh paslon lain
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 md:p-6">
            {visitSummary ? (
              <>
                <div className="h-[240px] sm:h-[280px] md:h-[320px] rounded-xl border border-slate-100 bg-white p-2 sm:p-3">
                  <ReactECharts
                    ref={pieChartRef}
                    option={visitPieOption}
                    notMerge
                    lazyUpdate
                    style={{ height: "100%", width: "100%" }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[240px] sm:h-[280px] md:h-[320px]">
                <div className="text-center text-slate-400">
                  <Icon icon="solar:pie-chart-2-bold" width={44} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Belum ada data kunjungan</p>
                  <p className="text-xs mt-1 text-slate-400">Mulai dari input kunjungan pertama</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Icon icon="solar:chat-line-bold" className="text-slate-700" width={20} />
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-slate-800 leading-tight">
                    Harapan
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Masukan responden dari hasil kunjungan
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 md:p-5 flex-1">
            {harapanList?.length > 0 ? (
              <div className="h-[260px] sm:h-[300px] md:h-[340px] overflow-y-auto pr-1 sm:pr-2 space-y-2.5">
                {harapanList.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-700">
                        {i + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                          {h}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[260px] sm:h-[300px] md:h-[340px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <Icon icon="solar:chat-line-bold" width={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Belum ada harapan</p>
                  <p className="text-xs mt-1">Masukan akan muncul setelah ada kunjungan selesai</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAP */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 sm:p-5 md:p-6 border border-slate-100">
        <h2 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Peta Kunjungan</h2>
        <div className="h-[350px] sm:h-[420px] md:h-[500px] lg:h-[550px]">
          <VisitMap visits={visits} />
        </div>
      </div>
    </div>
  );
}