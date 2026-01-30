import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../../../lib/axios";
import KelurahanMap from "./mapPaslon";
import { createPortal } from "react-dom";
import { Icon} from "@iconify/react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Normalize untuk matching dengan GeoJSON (hapus semua non-huruf)
const normalize = (str = "") =>
  str.toString().toUpperCase().replace(/[^A-Z]/g, "");

// Rapikan nama kota untuk label (hindari "Kota KOTA ...")
const formatCityLabel = (city = "") => {
  if (!city) return "";

  let cleaned = city.trim();

  cleaned = cleaned.replace(/^(KOTA)\s+/i, "");

  cleaned = cleaned
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

  return `Kota ${cleaned}`;
};

const formatDistrictName = (district = "") => {
  if (!district) return "";

  return district
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
};

export default function PaslonIndex() {
  const [chartRegionLabel, setChartRegionLabel] = useState("");
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [selectedCityCode, setSelectedCityCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");

  // Names for map filtering (sync dengan dropdown)
  const [selectedCityName, setSelectedCityName] = useState("");
  const [selectedDistrictName, setSelectedDistrictName] = useState("");

  const [chartRows, setChartRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDetail, setShowDetail] = useState(false);

  // Peta data untuk 3 level
  const [petaDataKota, setPetaDataKota] = useState([]);
  const [petaDataKecamatan, setPetaDataKecamatan] = useState([]);
  const [petaDataKelurahan, setPetaDataKelurahan] = useState([]);

  // GeoJSON untuk 3 level
  const [geoCity, setGeoCity] = useState(null);
  const [geoDistrict, setGeoDistrict] = useState(null);
  const [geoVillage, setGeoVillage] = useState(null);
  const [geoSeribu, setGeoSeribu] = useState(null);

  useEffect(() => {
    if (selectedDistrictName) {
      setChartRegionLabel(`Kecamatan ${formatDistrictName(selectedDistrictName)}`);
      return;
    }
  
    if (selectedCityName) {
      setChartRegionLabel(formatCityLabel(selectedCityName));
      return;
    }
  
    setChartRegionLabel("");
  }, [selectedCityName, selectedDistrictName]);  

  /* LOAD CITIES for filter dropdown */
  useEffect(() => {
    api.get("/wilayah/cities/31")
      .then(res => setCities(res.data || []))
      .catch(() => setCities([]));
  }, []);

  /* LOAD DISTRICTS for filter dropdown */
  useEffect(() => {
    if (!selectedCityCode) {
      setDistricts([]);
      return;
    }

    api.get(`/wilayah/districts/${selectedCityCode}`)
      .then(res => setDistricts(res.data || []))
      .catch(() => setDistricts([]));
  }, [selectedCityCode]);

  /* LOAD CHART */
  useEffect(() => {
    setLoading(true);

    const params = {};
    if (selectedCityCode) params.city_code = selectedCityCode;
    if (selectedDistrictCode) params.district_code = selectedDistrictCode;

    api.get("/suara/diagram-paslon", { params })
      .then(res => setChartRows(res.data || []))
      .catch(() => setChartRows([]))
      .finally(() => setLoading(false));
  }, [selectedCityCode, selectedDistrictCode]);

  const labels = useMemo(
    () => chartRows.map(r => r.city || r.district || r.village),
    [chartRows]
  );

  const chartData = {
    labels,
    datasets: [
      { label: "Paslon 01", data: chartRows.map(r => r.paslon_01 || 0), backgroundColor: "#FFD100" },
      { label: "Paslon 02", data: chartRows.map(r => r.paslon_02 || 0), backgroundColor: "#16a34a" },
      { label: "Paslon 03", data: chartRows.map(r => r.paslon_03 || 0), backgroundColor: "#C40000" },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" } },
    scales: { y: { beginAtZero: true } },
  };

  /* GEOJSON - Load semua 3 level */
  useEffect(() => {
    fetch("/data/id31_dki_jakarta.geojson").then(r => r.json()).then(setGeoCity);
    fetch("/data/district.geojson").then(r => r.json()).then(setGeoDistrict);
    fetch("/data/id31_dki_jakarta_village.geojson").then(r => r.json()).then(setGeoVillage);
    // fetch("/data/id31_dki_jakarta_kepseribu.geojson").then(r => r.json()).then(setGeoSeribu);
  }, []);

  /* PETA DATA - Load semua 3 level dari API */
  useEffect(() => {
    api.get("/peta/paslon/kota").then(res => setPetaDataKota(res.data.data || []));
    api.get("/peta/paslon/kecamatan").then(res => setPetaDataKecamatan(res.data.data || []));
    api.get("/peta/paslon/kelurahan").then(res => setPetaDataKelurahan(res.data.data || []));
  }, []);

  // Process suara data untuk setiap level
  const suaraKota = useMemo(() => {
    const o = {};
    petaDataKota.forEach(d => {
      if (!d.city || !d.suara) return;
      o[normalize(d.city)] = d.suara;
    });
    return o;
  }, [petaDataKota]);

  const suaraKecamatan = useMemo(() => {
    const o = {};
    petaDataKecamatan.forEach(d => {
      if (!d.district || !d.suara) return;
      o[normalize(d.district)] = d.suara;
    });
    return o;
  }, [petaDataKecamatan]);

  const suaraKelurahan = useMemo(() => {
    const o = {};
    petaDataKelurahan.forEach(d => {
      if (!d.village || !d.suara) return;
      // Include district info for filtering
      o[normalize(d.village)] = { ...d.suara, district: d.district };
    });
    return o;
  }, [petaDataKelurahan]);

  const isMapReady = geoCity && geoDistrict && geoVillage &&
    (Object.keys(suaraKota).length > 0 || Object.keys(suaraKecamatan).length > 0 || Object.keys(suaraKelurahan).length > 0);

  /* =========================================
     HANDLE MAP CLICK
     - Level Kota: Update selectedCityCode -> Fetch districts -> Chart updates
     - Level Kecamatan: Update selectedDistrictCode -> Chart updates
  ========================================= */
  const handleMapClick = (name, level) => {
    const raw = normalize(name);

    if (level === "kota") {
      // Find matching city
      const found = cities.find(c => normalize(c.city) === raw);
      if (found) {
        setSelectedCityCode(found.city_code);
        setSelectedDistrictCode("");
        setSelectedCityName(found.city);
        setSelectedDistrictName("");
        setChartRegionLabel(formatCityLabel(found.city));
      }
    } else if (level === "kecamatan") {
      // Find matching district
      const found = districts.find(d => normalize(d.district) === raw);
      if (found) {
        setSelectedDistrictCode(found.district_code);
        setSelectedDistrictName(found.district);
        setChartRegionLabel(`Kecamatan ${found.district}`);
      } else {
        // If districts not loaded yet, try to find from petaDataKecamatan
        const kecData = petaDataKecamatan.find(d => normalize(d.district) === raw);
        if (kecData) {
          const cityData = cities.find(c => normalize(c.city) === normalize(kecData.city));
          if (cityData) {
            setSelectedCityCode(cityData.city_code);
            setSelectedCityName(cityData.city);
            setSelectedDistrictName(kecData.district);
          }
        }
      }
    } else if (level === "kelurahan") {
        setChartRegionLabel(`Kelurahan ${name}`);
    }
    // Kelurahan level - just show info, don't change dropdown (mentok di kecamatan)
  };

  /* =========================================
     HANDLE LEVEL CHANGE (zoom out reset)
  ========================================= */
  const handleLevelChange = (level) => {
    if (level === "kota") {
      setSelectedCityCode("");
      setSelectedDistrictCode("");
      setSelectedCityName("");
      setSelectedDistrictName("");
      setChartRegionLabel("");
    }
  };


  return (
    <div className="space-y-4">

      {/* HEADER & FILTER */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
        <h1 className="text-3xl font-bold text-blue-900">
          Perolehan Suara Gubernur
        </h1>

        <div className="flex flex-col md:flex-row gap-3">
           
           {/* FILTER KOTA */}
        <div className="relative flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-white">
          <Icon
            icon="mdi:office-building"
            className="text-slate-500 w-5 h-5 shrink-0"
          />
          <select
            className="bg-transparent outline-none flex-1 cursor-pointer text-sm"
            value={selectedCityCode}
            onChange={(e) => {
              const cityCode = e.target.value;
              setSelectedCityCode(cityCode);
              setSelectedDistrictCode("");
              if (cityCode) {
                const found = cities.find(c => c.city_code === cityCode);
                if (found) {
                  setSelectedCityName(found.city);
                  setSelectedDistrictName("");
                  setChartRegionLabel(found ? formatCityLabel(found.city) : "");
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
            value={selectedDistrictCode}
            onChange={(e) => {
              const districtCode = e.target.value;
              setSelectedDistrictCode(districtCode);
              if (districtCode) {
                const found = districts.find(d => d.district_code === districtCode);
                if (found) {
                  setSelectedDistrictName(found.district);
                  setChartRegionLabel(`Kecamatan ${found.district}`);
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
                {formatDistrictName(d.district)}
              </option>
            ))}
          </select>
        </div>

          <button
            onClick={() => setShowDetail(true)}
            className="border border-blue-600 text-blue-600 rounded-lg px-4 py-2
                       hover:bg-blue-600 hover:text-white transition"
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
            Rekapitulasi Suara Paslon
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
              <Bar data={chartData} options={chartOptions} />
            </div>
          )}
        </div>

        {/* MAP */}
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Peta Sebaran Pemenang Paslon
          </div>

          <div className="h-[420px]">
            {isMapReady && (
              <KelurahanMap
                geoCity={geoCity}
                geoDistrict={geoDistrict}
                geoVillage={geoVillage}
                geoSeribu={geoSeribu}
                suaraKota={suaraKota}
                suaraKecamatan={suaraKecamatan}
                suaraKelurahan={suaraKelurahan}
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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDetail(false)}
            />

            <div className="relative bg-white w-full max-w-4xl max-h-[80vh]
                            rounded-2xl shadow-2xl p-6 overflow-auto z-10">
              <h2 className="text-lg font-semibold mb-4">
                Detail Perolehan Suara
              </h2>

              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Wilayah</th>
                    <th className="px-4 py-2 text-center">01</th>
                    <th className="px-4 py-2 text-center">02</th>
                    <th className="px-4 py-2 text-center">03</th>
                  </tr>
                </thead>
                <tbody>
                  {chartRows.map((r, i) => (
                    <tr key={i} className="border-t text-center">
                      <td className="px-4 py-2 text-left">
                        {r.city || r.district || r.village}
                      </td>
                      <td className="px-4 py-2">{r.paslon_01}</td>
                      <td className="px-4 py-2">{r.paslon_02}</td>
                      <td className="px-4 py-2 font-semibold">{r.paslon_03}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowDetail(false)}
                  className="px-5 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-800"
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
