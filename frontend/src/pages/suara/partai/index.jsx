import { useEffect, useMemo, useState } from "react";
import api from "../../../lib/axios";
import MapPartai from "./mapPartai";
import { createPortal } from "react-dom";
import ReactECharts from "echarts-for-react";
import { Icon } from "@iconify/react";

/* ======================
   SINGKATAN PARTAI
====================== */
const partyAbbr = {
  "Partai Kebangkitan Bangsa": "PKB",
  "Partai Gerakan Indonesia Raya": "GERINDRA",
  "Partai Demokrasi Indonesia Perjuangan": "PDI-P",
  "Partai Golongan Karya": "GOLKAR",
  "Partai Gelombang Rakyat Indonesia": "Gelora",
  "Partai NasDem": "NASDEM",
  "Partai Buruh": "BURUH",
  "Partai Keadilan Sejahtera": "PKS",
  "Partai Kebangkitan Nusantara": "PKN",
  "Partai Hati Nurani Rakyat": "HANURA",
  "Partai Amanat Nasional": "PAN",
  "Partai Persatuan Pembangunan": "PPP",
  "PARTAI PERINDO": "PERINDO",
  "Partai Solidaritas Indonesia": "PSI",
  "Partai Ummat": "UMMAT",
  "Partai Garda Republik Indonesia": "GARDA",
  "Partai Bulan Bintang": "PBB",
  "Partai Demokrat": "DEMOKRAT",
};  

/* ======================
   WARNA PARTAI
====================== */
const partyColors = {
  "100001": "#00764A",
  "100002": "#990001",
  "100003": "#D52027",
  "100004": "#FFF051",
  "100005": "#242464",
  "100006": "#FF6800",
  "100007": "#02CCFF",
  "100008": "#FC5100",
  "100009": "#FE0000",
  "100010": "#EE9B11",
  "100011": "#01274D",
  "100012": "#0054A3",
  "100013": "#00331C",
  "100014": "#004C9A",
  "100015": "#E62128",
  "100016": "#243E80",
  "100017": "#036302",
  "100024": "#000000",
};

const formatCityLabel = (city = "") => {
  if (!city) return "";

  let cleaned = city.trim();

  cleaned = cleaned.replace(/^(KOTA)\s+/i, "");

  cleaned = cleaned
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

  return `Kota ${cleaned}`;
};

const formatDistrictLabel = (district = "") => {
  if (!district) return "";
  return `Kecamatan ${district
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())}`;
};


export default function PartaiIndex() {
  /* ======================
     STATE DROPDOWN
  ====================== */
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [chartRegionLabel, setChartRegionLabel] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");     // For map filtering (city level)
  const [selectedDistrictName, setSelectedDistrictName] = useState(""); // For map filtering (district level)
  const [selectedPartyData, setSelectedPartyData] = useState(null);
  /* ======================
     STATE DATA
  ====================== */
  const [chartRows, setChartRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  /* ======================
     LOAD CITIES
  ====================== */
  useEffect(() => {
    api.get("/wilayah/cities/31")
      .then(res => setCities(res.data || []))
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    // PRIORITAS 1: Kecamatan
    if (selectedDistrictName) {
      setChartRegionLabel(formatDistrictLabel(selectedDistrictName));
      return;
    }
  
    // PRIORITAS 2: Kota
    if (selectedCityName) {
      setChartRegionLabel(formatCityLabel(selectedCityName));
      return;
    }
  
    // DEFAULT
    setChartRegionLabel("");
  }, [selectedCityName, selectedDistrictName]);  

    // Logika untuk menentukan pesan analisis
    const getAnalysisNote = (partyName, totalSuara, cityName) => {
      const suara = Number(totalSuara);
      const wilayah = cityName || 'DKI Jakarta';

      if (suara >= 1000000) {
        return ` ${partyName} mendominasi perolehan suara di ${wilayah} dengan capaian di atas 1 juta suara. Hasil ini menempatkan partai sebagai kekuatan utama di wilayah tersebut.`;
      } else if (suara >= 500000) {
        return ` ${partyName} menunjukkan performa yang kompetitif di ${wilayah}. Dukungan massa yang signifikan menjadi modal kuat untuk perolehan kursi legislatif.`;
      } else {
        return ` ${partyName} sedang berupaya meningkatkan basis dukungan di ${wilayah}. Data ini menjadi bahan evaluasi untuk penguatan strategi pemenangan di masa mendatang.`;
      }
    };

  /* ======================
     LOAD DISTRICTS
  ====================== */
  useEffect(() => {
    if (!selectedCity) {
      setDistricts([]);
      return;
    }

    api.get(`/wilayah/districts/${selectedCity}`)
      .then(res => setDistricts(res.data || []))
      .catch(() => setDistricts([]));
  }, [selectedCity]);

  /* ======================
     LOAD CHART DATA
  ====================== */
  useEffect(() => {
    setLoading(false);

    api.get("/suara/diagram-partai", {
      params: {
        city_code: selectedCity || undefined,
        district_code: selectedDistrict || undefined,
      },
    })
      .then(res => {
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) => a.total_suara - b.total_suara);
        setChartRows(rows);
      })
      .finally(() => setLoading(false));
  }, [selectedCity, selectedDistrict]);

  /* ======================
     GEOJSON - Load semua 3 level
  ====================== */
  const [geoCity, setGeoCity] = useState(null);
  const [geoDistrict, setGeoDistrict] = useState(null);
  const [geoVillage, setGeoVillage] = useState(null);
  const [geoSeribu, setGeoSeribu] = useState(null);

  useEffect(() => {
    fetch("/data/id31_dki_jakarta.geojson").then((r) => r.json()).then(setGeoCity);
    fetch("/data/district.geojson").then((r) => r.json()).then(setGeoDistrict);
    fetch("/data/id31_dki_jakarta_village.geojson").then((r) => r.json()).then(setGeoVillage);
    fetch("/data/id31_dki_jakarta_kepseribu.geojson").then((r) => r.json()).then(setGeoSeribu);
  }, []);

  /* ======================
     DATA - API Suara
  ====================== */
  const [petaDataKota, setPetaDataKota] = useState([]);
  const [petaDataKecamatan, setPetaDataKecamatan] = useState([]);

  useEffect(() => {
    api.get("/peta/partai/kota").then((res) => setPetaDataKota(res.data.data || []));
    api.get("/peta/partai/kecamatan").then((res) => setPetaDataKecamatan(res.data.data || []));
  }, []);

  /* ======================
     DATA PROCESSING
  ====================== */
  const normalize = (str = "") =>
    str
      .toString()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

  const suaraKota = useMemo(() => {
    const o = {};
    petaDataKota.forEach((d) => {
      if (!d.city || !d.winner_party) return;
      o[normalize(d.city)] = d;
    });
    return o;
  }, [petaDataKota]);

  const suaraKecamatan = useMemo(() => {
    const o = {};
    petaDataKecamatan.forEach((d) => {
      if (!d.district || !d.winner_party) return;
      o[normalize(d.district)] = d;
    });
    return o;
  }, [petaDataKecamatan]);

  // Build district-to-city mapping from API data
  const districtToCity = useMemo(() => {
    const mapping = {};
    petaDataKecamatan.forEach((d) => {
      if (d.district && d.city) {
        mapping[normalize(d.district)] = normalize(d.city);
      }
    });
    return mapping;
  }, [petaDataKecamatan]);

  const isMapReady =
    geoCity &&
    geoDistrict &&
    (Object.keys(suaraKota).length > 0 ||
      Object.keys(suaraKecamatan).length > 0);

  /* =========================================
     HANDLE MAP CLICK
  ========================================= */
  const handleMapClick = (name, level) => {
    const raw = normalize(name);

    if (level === "kota") {
      // Find city by name and set selectedCity
      const found = cities.find((c) => normalize(c.city) === raw);
      if (found) {
        setSelectedCity(found.city_code);
        setSelectedDistrict("");
        setSelectedCityName(found.city);
        setSelectedDistrictName(""); // Clear district filter when city is clicked
        setChartRegionLabel(formatCityLabel(found.city));
      }
    } else if (level === "kecamatan") {
      // Find district by name and set selectedDistrict
      const found = districts.find((d) => normalize(d.district) === raw);
      if (found) {
        setSelectedCity("");
        setSelectedCityName("");
        setSelectedDistrict(found.district_code);
        setSelectedDistrictName(found.district);
        setChartRegionLabel(formatDistrictLabel(found.district));
      }
    }
  };

  /* =========================================
     HANDLE LEVEL CHANGE (zoom out reset)
  ========================================= */
  const handleLevelChange = (level) => {
    // When zoomed out to city level, reset selections
    if (level === "kota") {
      setSelectedCity("");
      setSelectedDistrict("");
      setSelectedCityName("");
      setSelectedDistrictName("");
    }
  };

  /* ======================
     CHART PREP
  ====================== */
  const labels = useMemo(
    () => chartRows.map(r => partyAbbr[r.party] || r.party),
    [chartRows]
  );

  const values = useMemo(
    () => chartRows.map(r => r.total_suara),
    [chartRows]
  );

  const colors = useMemo(
    () => chartRows.map(
      r => partyColors[String(r.party_code)] || "#94a3b8"
    ),
    [chartRows]
  );
// helper biar warna lebih soft
const soften = (hex = "#94a3b8") => `${hex}CC`;

const echartOption = useMemo(() => ({
  tooltip: {
    trigger: "axis",
    axisPointer: {
      type: "shadow",
      shadowStyle: {
        color: "rgba(0,0,0,0.04)",
      },
    },
    backgroundColor: "#0f172a",
    textStyle: { color: "#fff" },
    padding: [8, 12],
    formatter: (params) => {
      const p = params[0];
      return `
        <div style="font-size:12px;opacity:.8">${p.name}</div>
        <div style="font-size:16px;font-weight:600">
          ${p.value.toLocaleString("id-ID")}
        </div>
      `;
    },
  },

  grid: {
    left: 50,
    right: 20,
    top: 20,
    bottom: 70,
  },

  xAxis: {
    type: "category",
    data: labels,
    axisLabel: {
      interval: 0,
      rotate: 30,
      color: "#64748b",
    },
  },

  yAxis: {
    type: "value",
    axisLabel: {
      formatter: (v) => v.toLocaleString("id-ID"),
      color: "#64748b",
    },
    splitLine: {
      lineStyle: { color: "#e5e7eb" },
    },
  },

  series: [
    {
      type: "bar",
      barMaxWidth: 42,
      emphasis: {
        focus: "series", // ⬅️ BAR LAIN FADED SAAT HOVER
      },
      data: values.map((v, i) => ({
        value: v,
        itemStyle: {
          color: soften(colors[i]),
          borderRadius: [6, 6, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: colors[i], // hover = solid
          },
        },
      })),
    },
  ],
}), [labels, values, colors]);

  return (
    <div className="space-y-4">

      {/* ================= HEADER & FILTER ================= */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
        <h1 className="text-3xl font-bold text-blue-900">
          Perolehan Suara Partai
        </h1>

        <div className="flex flex-col md:flex-row gap-3">

        {/* FILTER KOTA */}
        <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-white focus-within:ring-2 ring-blue-500">
          <Icon
            icon="mdi:office-building"
            className="text-slate-400 w-5 h-5 shrink-0"
          />
          <select
            className="bg-transparent outline-none flex-1 cursor-pointer text-sm"
            value={selectedCity}
            onChange={(e) => {
              const cityCode = e.target.value;
              setSelectedCity(cityCode);
              setSelectedDistrict("");

              if (cityCode) {
                const found = cities.find(c => c.city_code === cityCode);
                if (found) {
                  setSelectedCityName(found.city);
                  setSelectedDistrictName("");
                  setChartRegionLabel(formatCityLabel(found.city));
                }
              } else {
                setSelectedCityName("");
                setSelectedDistrictName("");
                setChartRegionLabel("");
              }
            }}
          >
            <option value="">Semua Kab/Kota (DKI)</option>
            {cities.map(c => (
              <option key={c.city_code} value={c.city_code}>
                {c.city}
              </option>
            ))}
          </select>
        </div>

        {/* FILTER KECAMATAN */}
        <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-white">
          <Icon
            icon="mdi:map-marker-outline"
            className="text-slate-500 w-5 h-5 shrink-0"
          />
          <select
            className="bg-transparent outline-none flex-1 cursor-pointer text-sm"
            value={selectedDistrict}
            onChange={(e) => {
              const districtCode = e.target.value;
              setSelectedDistrict(districtCode);
              setSelectedCity("");
              setSelectedCityName("");

              if (districtCode) {
                const found = districts.find(d => d.district_code === districtCode);
                if (found) {
                  setSelectedDistrictName(found.district);
                  setChartRegionLabel(formatDistrictLabel(found.district));
                }
              } else {
                setSelectedDistrictName("");
                setChartRegionLabel("");
              }
            }}
          >
            <option value="">Semua Kecamatan</option>
            {districts.map(d => (
              <option key={d.district_code} value={d.district_code}>
                {d.district}
              </option>
            ))}
          </select>
        </div>

        {/* DETAIL BUTTON */}
        <button
          onClick={() => setShowDetail(true)}
          className="
            border border-blue-600 text-blue-600
            rounded-lg px-4 py-2
            hover:bg-blue-600 hover:text-white
            transition
          "
        >
          Detail
        </button>
      </div>
      </div>

      {/* ================= GRID CHART + MAP ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* CHART */}
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 h-[500px] flex flex-col">
          <h3 className="font-semibold mb-2">
            Rekapitulasi Suara Partai
            {chartRegionLabel && (
              <span className="font-semibold mb-2">
                {" "}({chartRegionLabel})
              </span>
            )}
          </h3>

          {loading ? (
            <div className="text-center text-slate-500 mt-10">
              Memuat chart…
            </div>
          ) : (
            <div className="flex-1">
            <ReactECharts
              option={echartOption}
              style={{ width: "100%", height: "100%" }}
            />
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Peta Sebaran Pemenang Suara Partai
          </div>

          <div className="h-[420px]">
            {isMapReady && (
              <MapPartai
                geoCity={geoCity}
                geoDistrict={geoDistrict}
                geoSeribu={geoSeribu}
                suaraKota={suaraKota}
                suaraKecamatan={suaraKecamatan}
                selectedCityName={selectedCityName}
                selectedDistrictName={selectedDistrictName}
                onRegionClick={handleMapClick}
                onLevelChange={handleLevelChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* ================= MODAL DETAIL ================= */}
        {showDetail &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowDetail(false)}
              />

              <div className="relative bg-white w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col">
                
                {/* HEADER MODAL */}
                <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-extrabold text-blue-900">
                      Detail Perolehan Suara
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Data berdasarkan wilayah yang dipilih
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetail(false)}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold" width={32} />
                  </button>
                </div>

                {/* TABLE */}
        <div className="overflow-y-auto flex-1 custom-scrollbar" style={{ maxHeight: '60vh' }}>
          <table className="w-full border-separate border-spacing-0">
                  
                  <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-50">
                      <th className="px-6 py-4 text-left border-b-2 border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <span className="text-[11px] uppercase font-black tracking-widest text-slate-500">
                          Partai Politik
                        </span>
                      </th>
                      <th className="px-6 py-4 text-right border-b-2 border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <span className="text-[11px] uppercase font-black tracking-widest text-slate-500">
                          Total Suara
                        </span>
                      </th>
                    </tr>
                  </thead>

            <tbody className="bg-white">
              {[...chartRows].reverse().map((row, i) => (
                <tr 
                  key={i} 
                  className="group hover:bg-blue-50/50 transition-colors cursor-pointer" // Tambah cursor-pointer
                  onClick={() => setSelectedPartyData(row)} // Pindahkan ke sini
                >
                  <td className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      {/* LOGO */}
                      <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center p-2 group-hover:border-blue-300 transition-all">
                        <img 
                          src={`/partai/${partyAbbr[row.party]?.toLowerCase()}.png`}
                          alt={row.party}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${row.party}&background=random`;
                          }}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-tight">
                          {row.party}
                        </p>
                        <p className="text-[10px] text-blue-600 font-bold uppercase mt-1 tracking-wider">
                          {partyAbbr[row.party] || "Nasional"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right border-b border-slate-100">
                    <div className="inline-block">
                      <span className="text-lg font-black text-slate-900 tabular-nums">
                        {Number(row.total_suara).toLocaleString("id-ID")}
                      </span>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Suara Sah
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
                
                {/* BOX DETAIL PARTAI  */}
              {selectedPartyData && (
                <div className="absolute inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-right duration-300">
                  {/* Header Box Detail */}
                  <div className="p-6 border-b bg-blue-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedPartyData(null)} 
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                      >
                        <Icon icon="lucide:arrow-left" width={24} />
                      </button>
                      <h3 className="font-bold">Informasi Detail {selectedPartyData.party}</h3>
                    </div>
                  </div>

                  {/* Isi Data Box */}
                  <div className="p-8 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs text-slate-500 font-bold uppercase">Total Suara Terinput</p>
                        <p className="text-2xl font-black text-slate-800">
                          {Number(selectedPartyData.total_suara).toLocaleString("id-ID")}
                        </p>
                      </div>
                        
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Cakupan Wilayah</p>
                        <p className="text-xl font-bold text-slate-800 mt-1 truncate">
                        {selectedDistrictName || selectedCityName || "DKI Jakarta"}
                      </p>
                    </div>
                  </div>
                      


                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <Icon icon="solar:info-circle-bold" />
                      Catatan Analisis
                    </h4>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      {/* Panggil fungsi logika di sini */}
                      {getAnalysisNote(
                        selectedPartyData.party, 
                        selectedPartyData.total_suara, 
                        selectedCityName
                      )}
                      <br /><br />
                      <span className="text-xs opacity-75">
                        *Data ini merupakan hasil rekapitulasi suara sah yang telah diverifikasi oleh saksi resmi di lapangan.
                      </span>
                    </p>
                  </div>

                    <button 
                      onClick={() => setSelectedPartyData(null)}
                      className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                    >
                      Kembali ke Daftar Partai
                    </button>
                  </div>
                </div>
              )}


                {/* FOOTER MODAL */}
                <div className="p-4 border-t bg-slate-50 flex justify-end">
                  <button
                    onClick={() => setShowDetail(false)}
                    className="px-8 py-3 rounded-xl bg-blue-900 text-white font-bold hover:bg-blue-800 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>,
            document.getElementById("modal-root")
          )
        }
    </div>
  );
}
