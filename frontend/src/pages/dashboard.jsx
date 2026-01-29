import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import ReactECharts from "echarts-for-react";
import api from "../lib/axios";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// import VisitMap from "../components/maps/VisitMap"; // map udah ga dipake dulu

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
    path: "/koordinator",
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
    path: "/content",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    title: "Suara",
    desc: "Analisis Suara",
    icon: "solar:chart-bold",
    path: "/suara/dashboard",
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

export default function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role") || "Admin";

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

  const [visits, setVisits] = useState([]); // tetap ada biar gak banyak ubah
  const [isLoading, setIsLoading] = useState(true);

  const [visitSummary, setVisitSummary] = useState(null);
  const [harapanList, setHarapanList] = useState([]);
  const [visitPieOption, setVisitPieOption] = useState({});

  const [progressData, setProgressData] = useState([]);
  const [progressOption, setProgressOption] = useState({});

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // =========================================================================
  // ✅ INIT DATA: matiin peta/visit total (dummy promise)
  // =========================================================================
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    setIsLoading(true);

    Promise.allSettled([
      api.get("/dashboard"),
      // ✅ DUMMY: ganti api.get("/peta/visit") supaya gak request sama sekali
      Promise.resolve({ data: { success: true, data: [] } }),
      api.get("/dashboard/visit-summary"),
      api.get("/dashboard/progress-bar"),
    ])
      .then(([resSummary, resVisits, resVisitSummary, resProgress]) => {
        // 1) dashboard
        if (resSummary.status === "fulfilled" && resSummary.value?.data?.success) {
          const data = resSummary.value.data.data;
          setSummary(data || { koordinator_total: 0, relawan_total: 0 });
          if (data?.content_summary) setContentSummary(data.content_summary);
        } else {
          console.error("dashboard failed:", resSummary.reason);
        }

        // 2) visits (dummy)
        if (resVisits.status === "fulfilled" && resVisits.value?.data?.success) {
          setVisits(resVisits.value.data.data || []);
        }

        // 3) visit-summary
        if (resVisitSummary.status === "fulfilled" && resVisitSummary.value?.data?.success) {
          const data = resVisitSummary.value.data.data;
          setVisitSummary(data?.pie || null);
          setHarapanList(data?.harapan || []);
        }

        // 4) progress-bar
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
        left: isMobile ? 45 : isTablet ? 55 : 60,
        right: isMobile ? 45 : isTablet ? 60 : 70,
        top: 30,
        bottom: 30,
      },
      xAxis: {
        type: "value",
        axisLabel: {
          color: "#64748b",
          fontSize: isMobile ? 9 : isTablet ? 11 : 12,
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
          fontSize: isMobile ? 10 : isTablet ? 12 : 13,
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
          barWidth: isMobile ? 18 : isTablet ? 22 : 26,
          label: {
            show: true,
            position: "right",
            color: "#0f172a",
            fontWeight: "bold",
            fontSize: isMobile ? 10 : isTablet ? 12 : 14,
          },
          animationDuration: 1000,
          animationEasing: "elasticOut",
        },
      ],
    });
  }, [contentSummary.per_platform, isMobile, isTablet]);

  // =========================================================================
  // Stacked bar chart (ini boleh error, tapi jangan crash)
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
            itemWidth: isMobile ? 10 : isTablet ? 14 : 16,
            itemHeight: isMobile ? 10 : isTablet ? 14 : 16,
            itemGap: isMobile ? 8 : isTablet ? 12 : 24,
            icon: "roundRect",
            textStyle: {
              color: "#475569",
              fontSize: isMobile ? 9 : isTablet ? 11 : 13,
              fontWeight: 600,
            },
          },
          grid: {
            left: 10,
            right: isMobile ? 35 : isTablet ? 30 : 30,
            top: isMobile ? 35 : isTablet ? 45 : 50,
            bottom: isMobile ? 55 : isTablet ? 70 : 80,
          },
          xAxis: {
            type: "value",
            max: 100,
            interval: 25,
            axisLabel: {
              formatter: "{value}%",
              color: "#64748b",
              fontSize: isMobile ? 9 : isTablet ? 11 : 13,
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
              barWidth: isMobile ? "45%" : isTablet ? "55%" : "65%",
              itemStyle: {
                color: "#FF0000",
                borderRadius: [6, 0, 0, 6],
                shadowColor: "rgba(255, 0, 0, 0.3)",
                shadowBlur: 8,
                shadowOffsetY: 2,
              },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 8 : isTablet ? 10 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 12 : 6)) return "";
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
              itemStyle: { color: "#FACC15", shadowColor: "rgba(250, 204, 21, 0.3)", shadowBlur: 8, shadowOffsetY: 2 },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 8 : isTablet ? 10 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 12 : 6)) return "";
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
              itemStyle: { color: "#2563EB", shadowColor: "rgba(37, 99, 235, 0.3)", shadowBlur: 8, shadowOffsetY: 2 },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 8 : isTablet ? 10 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 12 : 6)) return "";
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
              itemStyle: { color: "#22C55E", borderRadius: [0, 6, 6, 0], shadowColor: "rgba(34, 197, 94, 0.3)", shadowBlur: 8, shadowOffsetY: 2 },
              label: {
                show: true,
                position: "inside",
                color: "#fff",
                fontSize: isMobile ? 8 : isTablet ? 10 : 12,
                fontWeight: "700",
                formatter: (params) => {
                  if (params.data.percent < (isMobile ? 12 : 6)) return "";
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
      .catch(() => {
        // ✅ jangan crash
      });
  }, [isMobile, isTablet]);

  // =========================================================================
  // Pie chart (kalo visitSummary ada)
  // =========================================================================
  useEffect(() => {
    if (!visitSummary) return;
    setVisitPieOption({
      tooltip: { show: false },
      legend: {
        bottom: isMobile ? 2 : isTablet ? 5 : 10,
        itemGap: isMobile ? 6 : isTablet ? 8 : 12,
        itemWidth: isMobile ? 8 : isTablet ? 10 : 12,
        itemHeight: isMobile ? 8 : isTablet ? 10 : 12,
        icon: "circle",
        textStyle: {
          fontSize: isMobile ? 8 : isTablet ? 10 : 11,
          color: "#475569",
        },
      },
      series: [
        {
          type: "pie",
          radius: "70%",
          center: ["50%", "45%"],
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
            fontSize: isMobile ? 8 : isTablet ? 9 : 11,
            fontWeight: "600",
            color: "#334155",
            lineHeight: isMobile ? 10 : isTablet ? 12 : 16,
          },
          labelLine: {
            show: true,
            length: isMobile ? 3 : isTablet ? 5 : 10,
            length2: isMobile ? 3 : isTablet ? 5 : 10,
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
  // Progress bar chart
  // =========================================================================
  useEffect(() => {
    if (!progressData.length) return;

    setProgressOption({
      grid: {
        left: 10,
        right: isMobile ? 35 : isTablet ? 120 : 200,
        top: 10,
        bottom: 10,
        containLabel: false,
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: {
          formatter: "{value}%",
          color: "#64748b",
          fontSize: isMobile ? 8 : isTablet ? 9 : 11,
        },
        splitLine: {
          lineStyle: { type: "dashed", color: "#e2e8f0" },
        },
      },
      yAxis: {
        type: "category",
        data: progressData.map(() => ""),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      series: [
        {
          type: "bar",
          data: progressData.map((i) => ({
            value: i.percent_positive || 0,
            labelText: isMobile
              ? `${i.percent_positive || 0}%`
              : `${i.percent_positive || 0}% (${i.positive_count || 0}/${i.total_count || 0})`,
          })),
          barWidth: isMobile ? 14 : isTablet ? 16 : 20,
          itemStyle: {
            color: "#2563EB",
            borderRadius: [0, 8, 8, 0],
          },
          label: {
            show: true,
            position: "right",
            formatter: (p) => p.data.labelText,
            color: "#0f172a",
            fontWeight: "bold",
            fontSize: isMobile ? 9 : isTablet ? 10 : 12,
            padding: [0, 0, 0, 6],
          },
          animationDuration: 1000,
          animationEasing: "elasticOut",
        },
      ],
    });
  }, [progressData, isMobile, isTablet]);

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 animate-in fade-in duration-500 px-2 sm:px-3 md:px-0">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-5 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 sm:w-40 sm:h-40 md:w-64 md:h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 sm:w-32 sm:h-32 md:w-48 md:h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Icon icon="solar:home-2-bold" width={isMobile ? 18 : isTablet ? 20 : 26} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Selamat Datang, {role}</h1>
              <p className="text-sm text-blue-100 mt-0.5">Sistem Manajemen SuperWeb</p>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {isLoading ? (
          <>
            <div className="h-24 sm:h-28 md:h-36 bg-slate-100 animate-pulse rounded-lg sm:rounded-xl md:rounded-2xl" />
            <div className="h-24 sm:h-28 md:h-36 bg-slate-100 animate-pulse rounded-lg sm:rounded-xl md:rounded-2xl" />
          </>
        ) : (
          <>
            <div className="group bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 text-white p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-0.5 sm:mb-1 md:mb-2">
                    <AnimateNumber value={summary.koordinator_total || 0} />
                  </div>
                  <div className="text-[10px] sm:text-xs md:text-sm text-blue-100 font-medium">
                    Total Koordinator
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <Icon icon="solar:user-id-bold" width={isMobile ? 20 : isTablet ? 22 : 28} />
                </div>
              </div>
            </div>

            <div className="group bg-gradient-to-br from-green-600 via-green-500 to-green-400 text-white p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-0.5 sm:mb-1 md:mb-2">
                    <AnimateNumber value={summary.relawan_total || 0} />
                  </div>
                  <div className="text-[10px] sm:text-xs md:text-sm text-green-100 font-medium">
                    Total Relawan
                  </div>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <Icon icon="solar:users-group-rounded-bold" width={isMobile ? 20 : isTablet ? 22 : 28} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* QUICK ACCESS */}
      <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm p-3 sm:p-5 md:p-8 border border-slate-100">
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 mb-3 sm:mb-4 md:mb-6">
          <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon icon="solar:widget-4-bold" className="text-blue-600" width={isMobile ? 16 : isTablet ? 18 : 22} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base md:text-xl font-bold text-slate-800">Akses Cepat</h2>
            <p className="text-[10px] sm:text-xs md:text-sm text-slate-500">Navigasi cepat ke fitur utama sistem</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {quickMenus.map((m) => (
            <div
              key={m.title}
              onClick={() => navigate(m.path)}
              className="group cursor-pointer rounded-lg md:rounded-xl border-2 border-slate-100 p-2 sm:p-3 md:p-5 hover:border-transparent hover:shadow-lg transition-all duration-300 relative overflow-hidden bg-white"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className="flex flex-col items-start gap-1.5 sm:gap-2 md:gap-4 mb-1.5 sm:mb-2 md:mb-3">
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-gradient-to-br ${m.gradient} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon icon={m.icon} width={isMobile ? 16 : isTablet ? 18 : 24} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-xs sm:text-sm md:text-base text-slate-800 group-hover:text-white transition-colors mb-0.5">{m.title}</div>
                    <div className="text-[9px] sm:text-[10px] md:text-xs text-slate-500 group-hover:text-white/80 transition-colors line-clamp-2">{m.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs md:text-sm font-semibold text-blue-600 group-hover:text-white transition-colors">
                  <span>Buka</span>
                  <Icon icon="solar:arrow-right-linear" width={isMobile ? 12 : isTablet ? 14 : 18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 md:p-6 border border-slate-100">
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Icon icon="solar:document-text-bold" className="text-purple-600" width={isMobile ? 18 : 22} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-800">Resume Konten</h2>
              <p className="text-xs md:text-sm text-slate-500">Jumlah konten yang telah diposting</p>
            </div>
          </div>

          <div className="h-[200px] md:h-[280px] mt-3 md:mt-4">
            <ReactECharts option={barOption} notMerge lazyUpdate style={{ height: "100%", width: "100%" }} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 md:w-48 md:h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-28 h-28 md:w-40 md:h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4 md:mb-8">
              <div>
                <div className="text-3xl md:text-5xl font-bold mb-1 md:mb-2">
                  <AnimateNumber value={contentSummary.comparison.posted || 0} /> / <AnimateNumber value={contentSummary.comparison.target || 0} />
                </div>
                <div className="text-xs md:text-base text-indigo-100 font-medium">Total Postingan Konten</div>
              </div>
              <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Icon icon="solar:chart-2-bold" width={isMobile ? 24 : 28} />
              </div>
            </div>

            <div className="space-y-3 md:space-y-5">
              <div>
                <div className="flex justify-between text-xs md:text-sm mb-2 font-medium">
                  <span className="text-indigo-100">Target</span>
                  <span>{contentSummary.comparison.target || 0}</span>
                </div>
                <div className="h-2 md:h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div className="h-full rounded-full bg-white/50 transition-all duration-1000" style={{ width: "100%" }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs md:text-sm mb-2 font-medium">
                  <span className="text-indigo-100">Posted</span>
                  <span>{contentSummary.comparison.posted || 0}</span>
                </div>
                <div className="h-2 md:h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
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

              <div className="text-center pt-3 md:pt-4 border-t border-white/20">
                <div className="text-3xl md:text-5xl font-bold mb-1">
                  {(contentSummary.comparison.target || 0) > 0
                    ? Math.round(((contentSummary.comparison.posted || 0) / (contentSummary.comparison.target || 0)) * 100)
                    : 0}
                  %
                </div>
                <div className="text-xs md:text-sm text-indigo-100 font-medium">Tercapai dari Target</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SURVEY CHART */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 md:p-6 border border-slate-100">
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Icon icon="solar:chart-square-bold" className="text-orange-600" width={isMobile ? 18 : 22} />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-800">Resume Survey</h2>
            <p className="text-xs md:text-sm text-slate-500">Distribusi jawaban responden untuk tiap pertanyaan</p>
          </div>
        </div>

        <div className="flex gap-2 md:gap-4 h-[400px] md:h-[500px] mt-3 md:mt-4">
          <div className="flex flex-col justify-around py-12 md:py-16">
            {stackedData.map((item, idx) => {
              const label = item.question || "";
              const words = label.split(" ");
              const mid = Math.ceil(words.length / 2);
              const line1 = words.slice(0, mid).join(" ");
              const line2 = words.slice(mid).join(" ");

              return (
                <div
                  key={idx}
                  className="text-[10px] md:text-[13px] font-bold text-slate-800 leading-tight text-left"
                  style={{ minWidth: isMobile ? "90px" : "160px" }}
                >
                  <div>{line1}</div>
                  <div>{line2 || "\u00A0"}</div>
                </div>
              );
            })}
          </div>

          <div className="flex-1">
            <ReactECharts option={stackedOption} notMerge lazyUpdate style={{ height: "100%", width: "100%" }} />
          </div>
        </div>
      </div>

      {/* ANALISIS CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 md:p-6">
          <h2 className="font-bold text-base md:text-lg mb-3 md:mb-4">Persentase Dukungan</h2>

          <div className="flex gap-2 md:gap-3 h-[200px] md:h-[280px]">
            <div className="flex flex-col justify-around py-2">
              {progressData.map((item, idx) => {
                const label = (item.question || "").replaceAll("_", " ").toUpperCase();
                const words = label.split(" ");
                const mid = Math.ceil(words.length / 2);
                const line1 = words.slice(0, mid).join(" ");
                const line2 = words.slice(mid).join(" ");

                return (
                  <div
                    key={idx}
                    className="text-[9px] md:text-[11px] font-semibold text-slate-700 leading-tight text-left"
                    style={{ minWidth: isMobile ? "100px" : "140px" }}
                  >
                    <div>{line1}</div>
                    <div>{line2 || "\u00A0"}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex-1">
              <ReactECharts option={progressOption} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 md:p-6">
          <h2 className="font-bold text-base md:text-lg mb-3 md:mb-4">Status Kunjungan</h2>
          <div className="h-[200px] md:h-[280px]">
            <ReactECharts option={visitPieOption} style={{ height: "100%" }} />
          </div>
        </div>

        <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 md:p-6 flex flex-col h-[280px] md:h-[360px]">
          <h2 className="font-bold text-base md:text-lg mb-3 md:mb-4">Harapan</h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {harapanList.map((h, i) => (
              <div key={i} className="p-2 md:p-3 rounded-lg md:rounded-xl bg-slate-100 text-xs md:text-sm shadow-sm leading-relaxed">
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MAP SECTION dimatiin dulu */}
      {/*
      <div className="bg-white rounded-xl md:rounded-2xl shadow-sm p-4 md:p-6 border border-slate-100">
        ...
        <VisitMap visits={visits} />
      </div>
      */}
    </div>
  );
}
