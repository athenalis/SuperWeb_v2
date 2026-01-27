import { useEffect, useMemo, useState } from "react";
import api from "../../../lib/axios";
import MapDpt from "./mapDpt";
import { Icon } from "@iconify/react";

export default function DptIndex() {
  /* ======================
     STATE DROPDOWN
  ====================== */
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  const [selectedCityCode, setSelectedCityCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");

  // Names for map filtering
  const [selectedCityName, setSelectedCityName] = useState("");
  const [selectedDistrictName, setSelectedDistrictName] = useState("");

  /* ======================
     GEOJSON - Load 4 geojson
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
     LOAD CITIES for filter dropdown
  ====================== */
  useEffect(() => {
    api.get("/wilayah/cities/31")
      .then(res => setCities(res.data || []))
      .catch(() => setCities([]));
  }, []);

  /* ======================
     LOAD DISTRICTS for filter dropdown
  ====================== */
  useEffect(() => {
    if (!selectedCityCode) {
      setDistricts([]);
      return;
    }

    api.get(`/wilayah/districts/${selectedCityCode}`)
      .then(res => setDistricts(res.data || []))
      .catch(() => setDistricts([]));
  }, [selectedCityCode]);

  /* ======================
     DATA - API Suara (DPT)
  ====================== */
  const [dptDataKota, setDptDataKota] = useState([]);
  const [dptDataKecamatan, setDptDataKecamatan] = useState([]);
  const [dptDataKelurahan, setDptDataKelurahan] = useState([]);
  const [legend, setLegend] = useState([]);

  useEffect(() => {
    api.get("/peta/dpt/kota").then((res) => {
      setDptDataKota(res.data.data || []);
      setLegend(res.data.legend || []);
    });
    api.get("/peta/dpt/kecamatan").then((res) => setDptDataKecamatan(res.data.data || []));
    api.get("/peta/dpt/kelurahan").then((res) => setDptDataKelurahan(res.data.data || []));
  }, []);

  /* ======================
     MAPPING DATA BY NORMALIZED NAME
  ====================== */
  const normalize = (str = "") =>
    str
      .toString()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

  const dptKota = useMemo(() => {
    const obj = {};
    dptDataKota.forEach((d) => {
      if (d.city) {
        obj[normalize(d.city)] = d;
      }
    });
    return obj;
  }, [dptDataKota]);

  const dptKecamatan = useMemo(() => {
    const obj = {};
    dptDataKecamatan.forEach((d) => {
      if (d.district) {
        obj[normalize(d.district)] = d;
      }
    });
    return obj;
  }, [dptDataKecamatan]);

  const dptKelurahan = useMemo(() => {
    const obj = {};
    dptDataKelurahan.forEach((d) => {
      if (d.village) {
        obj[normalize(d.village)] = d;
      }
    });
    return obj;
  }, [dptDataKelurahan]);

  // Check readiness
  const isMapReady =
    geoCity &&
    geoDistrict &&
    geoVillage &&
    (Object.keys(dptKota).length > 0 ||
      Object.keys(dptKecamatan).length > 0 ||
      Object.keys(dptKelurahan).length > 0);

  /* =========================================
     HANDLE MAP CLICK
  ========================================= */
  const handleMapClick = (name, level) => {
    const raw = normalize(name);

    if (level === "kota") {
      const found = cities.find(c => normalize(c.city) === raw);
      if (found) {
        setSelectedCityCode(found.city_code);
        setSelectedDistrictCode("");
        setSelectedCityName(found.city);
        setSelectedDistrictName("");
      }
    } else if (level === "kecamatan") {
      const found = districts.find(d => normalize(d.district) === raw);
      if (found) {
        setSelectedDistrictCode(found.district_code);
        setSelectedDistrictName(found.district);
      } else {
        // Try to find from dptDataKecamatan if districts not loaded
        const kecData = dptDataKecamatan.find(d => normalize(d.district) === raw);
        if (kecData && kecData.city) {
          const cityData = cities.find(c => normalize(c.city) === normalize(kecData.city));
          if (cityData) {
            setSelectedCityCode(cityData.city_code);
            setSelectedCityName(cityData.city);
            setSelectedDistrictName(kecData.district);
          }
        }
      }
    }
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
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER & FILTER */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
        <h1 className="text-3xl font-bold text-blue-900">
          Peta Persebaran Daerah Prioritas DPT
        </h1>
      </div>

      {/* MAP */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">
          Peta Sebaran DPT
        </div>

        <div className="h-[500px]">
          {isMapReady ? (
            <MapDpt
              geoCity={geoCity}
              geoDistrict={geoDistrict}
              geoVillage={geoVillage}
              geoSeribu={geoSeribu}
              dptKota={dptKota}
              dptKecamatan={dptKecamatan}
              dptKelurahan={dptKelurahan}
              legend={legend}
              selectedCityName={selectedCityName}
              selectedDistrictName={selectedDistrictName}
              onRegionClick={handleMapClick}
              onLevelChange={handleLevelChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Memuat Peta...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
