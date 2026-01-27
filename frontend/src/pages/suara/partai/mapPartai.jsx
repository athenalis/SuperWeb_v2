import { MapContainer, TileLayer, GeoJSON, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useMemo, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ======================
   UTIL
====================== */
const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

const normalizeKey = (str = "") =>
  str
    .toString()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

/* ======================
   CONSTANTS
====================== */
const ZOOM_KOTA = 11; // < 11 = kota, >= 11 = kecamatan

/* ======================
   SINGKATAN PARTAI
====================== */
const partyAbbr = {
  "Partai Kebangkitan Bangsa": "PKB",
  "Partai Gerakan Indonesia Raya": "GERINDRA",
  "Partai Demokrasi Indonesia Perjuangan": "PDI-P",
  "Partai Golongan Karya": "GOLKAR",
  "Partai Gelombang Rakyat Indonesia": "GELORA",
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
   CITY NAME ALIAS
   (Handle GeoJSON naming variations like "Kota Adm. Jakarta Barat" -> "JAKARTABARAT")
====================== */
const CITY_ALIAS_RAW = {
  // Dropdown format (KOTA ADM. JAKARTA ...) -> normalized key
  KOTAADMJAKARTABARAT: "JAKARTABARAT",
  KOTAADMJAKARTAPUSAT: "JAKARTAPUSAT",
  KOTAADMJAKARTASELATAN: "JAKARTASELATAN",
  KOTAADMJAKARTATIMUR: "JAKARTATIMUR",
  KOTAADMJAKARTAUTARA: "JAKARTAUTARA",
  // GeoJSON format (Adm. ..., Kota Adm. ...) -> normalized key
  ADMJAKARTABARAT: "JAKARTABARAT",
  ADMJAKARTAPUSAT: "JAKARTAPUSAT",
  ADMJAKARTASELATAN: "JAKARTASELATAN",
  ADMJAKARTATIMUR: "JAKARTATIMUR",
  ADMJAKARTAUTARA: "JAKARTAUTARA",
  // Kepulauan Seribu variations
  ADMKEPSERIBU: "KEPULAUANSERIBU",
  KABADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  KABADMKEPSERIBU: "KEPULAUANSERIBU",
  KEPULAUANSERIBU: "KEPULAUANSERIBU",
  KEPSERIBU: "KEPULAUANSERIBU",
  ADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
};

const CITY_ALIAS = Object.fromEntries(
  Object.entries(CITY_ALIAS_RAW).map(([k, v]) => [normalizeKey(k), v])
);

// Helper to get canonical city key
const getCityKey = (name = "") => {
  const raw = normalizeKey(name);
  return CITY_ALIAS[raw] || raw;
};

/* ======================
   CITY TO DISTRICT MAPPING
   (Which districts belong to which city)
====================== */
const CITY_DISTRICTS = {
  JAKARTABARAT: ["CENGKARENG", "GROGOLPETAMBURAN", "TAMANSARI", "TAMBORA", "KEBONJERUK", "KALIDERES", "PALMERAH", "KEMBANGAN"],
  JAKARTAPUSAT: ["CEMPAKAPUTIH", "GAMBIR", "JOHARBARU", "KEMAYORAN", "MENTENG", "SAWAHBESAR", "SENEN", "TANAHABANG"],
  JAKARTASELATAN: ["CILANDAK", "JAGAKARSA", "KEBAYORANBARU", "KEBAYORANLAMA", "MAMPANGPRAPATAN", "PANCORAN", "PASARMINGGU", "PESANGGRAHAN", "SETIABUDI", "TEBET"],
  JAKARTATIMUR: ["CAKUNG", "CIPAYUNG", "CIRACAS", "DURENSAWIT", "JATINEGARA", "KRAMATJATI", "MAKASAR", "MATRAMAN", "PASARREBO", "PULOGADUNG"],
  JAKARTAUTARA: ["CILINCING", "KELAPAGADING", "KOJA", "PADEMANGAN", "PENJARINGAN", "TANJUNGPRIOK"],
  KEPULAUANSERIBU: ["KEPULAUANSERIBUSELATAN", "KEPULAUANSERIBUUTARA"],
};

const DISTRICT_ALIAS_RAW = {
  // Kelapa Gading variations
  KELAPAGADINGBARAT: "KELAPAGADING",
  KELAPAGADINGTIMUR: "KELAPAGADING",
  // Mampang variations
  MAMPANG: "MAMPANGPRAPATAN",
  MAMPANGPERAPATAN: "MAMPANGPRAPATAN",
  // Grogol Petamburan variations  
  GROGOL: "GROGOLPETAMBURAN",
  PETAMBURAN: "GROGOLPETAMBURAN",
  GROGOLPERTAMBURAN: "GROGOLPETAMBURAN",
  "GROGOL PERTAMBURAN": "GROGOLPETAMBURAN",
  // Tanjung Priok variations
  TANJUNGPRIUK: "TANJUNGPRIOK",
  // Other common variations
  KEBONJERUKTIMUR: "KEBONJERUK",
  KEBONJERUKUTARA: "KEBONJERUK",
  PALMERIEM: "PALMERAH",
  DURI: "TAMBORA",
};

const DISTRICT_ALIAS = Object.fromEntries(
  Object.entries(DISTRICT_ALIAS_RAW).map(([k, v]) => [normalizeKey(k), v])
);

// Helper to get canonical district key
const getDistrictKey = (name = "") => {
  const raw = normalizeKey(name);
  return DISTRICT_ALIAS[raw] || raw;
};

// Flatten for reverse lookup (district -> city)
const DISTRICT_TO_CITY = {};
Object.entries(CITY_DISTRICTS).forEach(([city, districts]) => {
  districts.forEach((d) => {
    DISTRICT_TO_CITY[d] = city;
  });
});

/* ======================
   ZOOM HANDLER
====================== */
function ZoomHandler({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, []);

  return null;
}

/* ======================
   MAP CONTROLLER - Auto zoom to selected region
====================== */
function MapController({ geoCity, geoDistrict, selectedCityName, selectedDistrictName }) {
  const map = useMap();

  // Helper to extract Jakarta city key (BARAT, PUSAT, SELATAN, TIMUR, UTARA)
  const extractJakartaKey = (str = "") => {
    const normalized = normalizeKey(str);
    if (normalized.includes("BARAT")) return "JAKARTABARAT";
    if (normalized.includes("PUSAT")) return "JAKARTAPUSAT";
    if (normalized.includes("SELATAN")) return "JAKARTASELATAN";
    if (normalized.includes("TIMUR")) return "JAKARTATIMUR";
    if (normalized.includes("UTARA")) return "JAKARTAUTARA";
    if (normalized.includes("SERIBU")) return "KEPULAUANSERIBU";
    return getCityKey(str);
  };

  // Zoom to selected city
  useEffect(() => {
    if (!selectedCityName || !geoCity) return;

    const targetKey = extractJakartaKey(selectedCityName);
    console.log("Looking for city:", selectedCityName, "-> key:", targetKey);

    // Find the city feature in GeoJSON
    const cityFeature = geoCity.features?.find((f) => {
      const wadmkk = f.properties?.WADMKK || "";
      const namobj = f.properties?.NAMOBJ || "";
      const featureKey = extractJakartaKey(wadmkk || namobj);
      return featureKey === targetKey;
    });

    if (cityFeature) {
      console.log("Found city feature:", cityFeature.properties);
      const bounds = L.geoJSON(cityFeature).getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      console.log("City not found. Available cities:",
        geoCity.features?.map(f => f.properties?.WADMKK)
      );
    }
  }, [selectedCityName, geoCity, map]);

  // Zoom to selected district
  useEffect(() => {
    if (!selectedDistrictName || !geoDistrict) return;

    const normalizedDistrict = getDistrictKey(selectedDistrictName);
    console.log("Looking for district:", selectedDistrictName, "-> normalized:", normalizedDistrict);

    // Find the district feature in GeoJSON
    const districtFeature = geoDistrict.features?.find((f) => {
      const name = f.properties?.name || f.properties?.NAMOBJ || "";
      return getDistrictKey(name) === normalizedDistrict;
    });

    if (districtFeature) {
      console.log("Found district feature:", districtFeature.properties);
      const bounds = L.geoJSON(districtFeature).getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      console.log("District not found. Available districts:",
        geoDistrict.features?.slice(0, 10).map(f => f.properties?.name)
      );
    }
  }, [selectedDistrictName, geoDistrict, map]);

  return null;
}

/* ======================
   MAIN COMPONENT
====================== */
export default function MapPartai({
  geoCity,
  geoDistrict,
  geoSeribu,
  suaraKota,
  suaraKecamatan,
  selectedCityName,     // City to filter districts by
  selectedDistrictName, // Single district to highlight (optional)
  onRegionClick,        // Callback: (name, level) => void
  onLevelChange,        // Callback: (level) => void - when zoom changes view level
  mapRef: externalMapRef, // Optional external ref to control map
}) {
  const internalMapRef = useRef();
  const mapRef = externalMapRef || internalMapRef;
  const [currentZoom, setCurrentZoom] = useState(10);
  const [prevLevel, setPrevLevel] = useState("kota");

  // Determine Level: Only kota or kecamatan
  const currentLevel = useMemo(() => {
    if (currentZoom < ZOOM_KOTA) return "kota";
    return "kecamatan";
  }, [currentZoom]);

  // Notify parent when level changes (for reset on zoom out)
  useEffect(() => {
    if (currentLevel !== prevLevel) {
      setPrevLevel(currentLevel);
      if (onLevelChange) {
        onLevelChange(currentLevel);
      }
    }
  }, [currentLevel, prevLevel, onLevelChange]);

  // Aggregate Data
  const kotaVotes = useMemo(() => {
    const out = {};
    Object.entries(suaraKota || {}).forEach(([name, data]) => {
      out[normalizeKey(name)] = data;
    });
    return out;
  }, [suaraKota]);

  const kecamatanVotes = useMemo(() => {
    const out = {};
    Object.entries(suaraKecamatan || {}).forEach(([name, data]) => {
      out[normalizeKey(name)] = data;
    });
    return out;
  }, [suaraKecamatan]);

  // Get Name from GeoJSON
  const getGeoName = (properties = {}, level) => {
    if (level === "kota") {
      return properties.city || properties.NAMOBJ || properties.WADMKK || properties.NAME || properties.name || "";
    }
    // kecamatan
    return properties.district || properties.name || properties.NAMOBJ || properties.WADMKC || properties.NAME || "";
  };

  // Get city name from GeoJSON properties (for district filtering)
  const getGeoCityName = (properties = {}) => {
    return properties.city || properties.NAMOBJ_PARENT || properties.WADMKK || "";
  };

  // Get Data by Level
  const getData = (name = "", level) => {
    if (level === "kota") {
      return kotaVotes[normalizeKey(name)] || null;
    }
    return kecamatanVotes[normalizeKey(name)] || null;
  };

  // Get Current GeoJSON
  const currentGeoJson = useMemo(() => {
    if (currentLevel === "kota") return geoCity;
    return geoDistrict;
  }, [currentLevel, geoCity, geoDistrict]);

  // Check if district belongs to selected city
  const isDistrictInSelectedCity = (districtName) => {
    if (!selectedCityName) return true; // No filter, show all
    const canonicalDistrict = getDistrictKey(districtName);
    const cityOfDistrict = DISTRICT_TO_CITY[canonicalDistrict];
    const selectedCityNormalized = getCityKey(selectedCityName);
    return cityOfDistrict === selectedCityNormalized;
  };

  // Check if this is the specifically selected district
  const isSelectedDistrict = (districtName) => {
    if (!selectedDistrictName) return false;
    return getDistrictKey(districtName) === getDistrictKey(selectedDistrictName);
  };

  // Style
  const styleFeature = (feature) => {
    const name = getGeoName(feature.properties, currentLevel);
    const data = getData(name, currentLevel);

    // If at kecamatan level
    if (currentLevel === "kecamatan") {
      // If a specific district is selected, only show that one
      if (selectedDistrictName) {
        if (!isSelectedDistrict(name)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.5,
            fillOpacity: 0.5,
          };
        }
      }
      // If only a city is selected (but not a specific district), filter by city
      else if (selectedCityName) {
        if (!isDistrictInSelectedCity(name)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.5,
            fillOpacity: 0.5,
          };
        }
      }
    }

    return {
      fillColor: data?.winner_color || "#e5e7eb",
      color: "#ffffff",
      weight: currentLevel === "kota" ? 2 : 1,
      fillOpacity: 0.85,
    };
  };

  // On Each Feature (Tooltip + Click)
  const onEachFeature = (feature, layer) => {
    const p = feature.properties;
    const name = getGeoName(p, currentLevel);
    const data = getData(name, currentLevel);

    const levelLabel = currentLevel === "kota" ? "Kota/Kabupaten" : "Kecamatan";

    // Skip tooltip for filtered-out districts
    if (currentLevel === "kecamatan" && selectedCityName && !isDistrictInSelectedCity(name)) {
      return;
    }

    let html = `
      <div style="font-family:system-ui;font-size:12px;min-width:200px">
        <div style="color:#6b7280;font-size:10px;text-transform:uppercase;margin-bottom:2px">
          ${levelLabel}
        </div>
        <div style="font-weight:600;font-size:13px;margin-bottom:6px">
          ${name}
        </div>
    `;

    if (data) {
      const winner = data.parties?.find((p) => p.party === data.winner_party);
      html += `
        <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e5e7eb;padding-top:4px">
          <span style="font-weight:600;color:${data.winner_color}">
            ${partyAbbr[data.winner_party] || data.winner_party}
          </span>
          <b>${fmt(winner?.jumlah)} suara</b>
        </div>
      `;
    } else {
      html += `<i style="color:#6b7280">Data tidak tersedia</i>`;
    }

    html += `</div>`;

    layer.bindTooltip(html, { sticky: true, opacity: 0.95 });

    layer.on({
      mouseover: () =>
        layer.setStyle({
          weight: currentLevel === "kota" ? 4 : 2.5,
          fillOpacity: 1,
        }),
      mouseout: () =>
        layer.setStyle({
          weight: currentLevel === "kota" ? 2 : 1,
          fillOpacity: 0.85,
        }),
      click: (e) => {
        // Zoom to clicked region
        const map = layer._map;
        map.fitBounds(e.target.getBounds());

        // Trigger callback
        if (onRegionClick) {
          onRegionClick(name, currentLevel);
        }
      },
    });
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        ref={mapRef}
        center={[-6.2, 106.8]}
        zoom={10}
        className="h-full w-full outline-none"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <ZoomHandler onZoomChange={setCurrentZoom} />

        <MapController
          geoCity={geoCity}
          geoDistrict={geoDistrict}
          selectedCityName={selectedCityName}
          selectedDistrictName={selectedDistrictName}
        />

        {currentGeoJson && (
          <GeoJSON
            key={`${currentLevel}-${currentZoom}-${selectedCityName || "all"}-${selectedDistrictName || "none"}`}
            data={currentGeoJson}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* INSET KEPULAUAN SERIBU - Top Right */}
      {geoSeribu && (
        <div className="
          absolute top-3 right-3 
          w-32 h-32 
          sm:w-36 sm:h-36 
          md:w-44 md:h-44 
          bg-white/80 backdrop-blur-sm border rounded shadow 
          z-[400]
        ">
          <MapContainer
            center={[-5.8, 106.6]}
            zoom={9}
            zoomControl={false}
            dragging={false}
            scrollWheelZoom={false}
            className="h-full w-full"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeoJSON
              data={geoSeribu}
              style={styleFeature}
              onEachFeature={onEachFeature}
            />
          </MapContainer>
        </div>
      )}

      {/* ZOOM LEVEL INDICATOR - Bottom Right */}
      <div
        className="
          absolute bottom-3 right-3
          bg-white/70 backdrop-blur-sm
          rounded-lg shadow-md
          px-2 py-1.5 
          text-[10px] sm:text-xs
          z-[500]
        "
      >
        <div className="text-slate-500">Level Peta:</div>
        <div className="font-semibold text-slate-800">
          {currentLevel === "kota" ? "Kota/Kabupaten" : "Kecamatan"}
        </div>
        {selectedCityName && (
          <div className="text-blue-600 text-[9px] sm:text-[10px] mt-0.5">
            📍 {selectedCityName}
          </div>
        )}
      </div>

      {/* LEGENDA PARTAI - Bottom Left, Transparent, Responsive */}
      <div
        className="
          absolute bottom-3 left-3
          bg-white/60 backdrop-blur-sm
          rounded-lg shadow-md
          px-2 py-1.5
          z-[500]
        "
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-2 gap-y-0.5 text-[8px] sm:text-[9px] md:text-[10px]">
          {[
            ["#00764A", "PKB"],
            ["#990001", "GERINDRA"],
            ["#D52027", "PDI-P"],
            ["#FFF051", "GOLKAR"],
            ["#242464", "NASDEM"],
            ["#FF6800", "GELORA"],
            ["#02CCFF", "BURUH"],
            ["#FC5100", "PKS"],
            ["#FE0000", "PKN"],
            ["#EE9B11", "HANURA"],
            ["#01274D", "PAN"],
            ["#0054A3", "PPP"],
            ["#00331C", "PERINDO"],
            ["#004C9A", "PSI"],
            ["#E62128", "UMMAT"],
            ["#243E80", "GARDA"],
            ["#036302", "PBB"],
            ["#000000", "DEMOKRAT"],
          ].map(([c, t]) => (
            <div key={t} className="flex items-center gap-0.5">
              <span
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: c }}
              />
              <span className="truncate">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
