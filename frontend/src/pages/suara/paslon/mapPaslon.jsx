import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useMemo, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const fmt = n => Number(n || 0).toLocaleString("id-ID");

const normalizeKey = (str = "") =>
  str
    .toString()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

// ============ CITY ALIAS ============
const CITY_ALIAS_RAW = {
  // Jakarta
  KOTAADMJAKARTABARAT: "JAKARTABARAT",
  KOTAADMJAKARTAPUSAT: "JAKARTAPUSAT",
  KOTAADMJAKARTASELATAN: "JAKARTASELATAN",
  KOTAADMJAKARTATIMUR: "JAKARTATIMUR",
  KOTAADMJAKARTAUTARA: "JAKARTAUTARA",
  // Additional formats
  ADMJAKARTABARAT: "JAKARTABARAT",
  ADMJAKARTAPUSAT: "JAKARTAPUSAT",
  ADMJAKARTASELATAN: "JAKARTASELATAN",
  ADMJAKARTATIMUR: "JAKARTATIMUR",
  ADMJAKARTAUTARA: "JAKARTAUTARA",
  // Kepulauan Seribu (SEMUA VARIASI → SATU)
  KABADMKEPSERIBU: "KEPULAUANSERIBU",
  KABUPATENADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  ADMKEPSERIBU: "KEPULAUANSERIBU",
  KEPULAUANSERIBU: "KEPULAUANSERIBU",
  KABADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  ADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  KEPSERIBU: "KEPULAUANSERIBU",
};

const CITY_ALIAS = Object.fromEntries(
  Object.entries(CITY_ALIAS_RAW).map(([k, v]) => [
    normalizeKey(k),
    normalizeKey(v),
  ])
);

const getCityKey = (name = "") => {
  const raw = normalizeKey(name);
  return CITY_ALIAS[raw] || raw;
};

// ============ CITY TO DISTRICT MAPPING ============
const CITY_DISTRICTS = {
  JAKARTABARAT: ["CENGKARENG", "GROGOLPETAMBURAN", "TAMANSARI", "TAMBORA", "KEBONJERUK", "KALIDERES", "PALMERAH", "KEMBANGAN"],
  JAKARTAPUSAT: ["CEMPAKAPUTIH", "GAMBIR", "JOHARBARU", "KEMAYORAN", "MENTENG", "SAWAHBESAR", "SENEN", "TANAHABANG"],
  JAKARTASELATAN: ["CILANDAK", "JAGAKARSA", "KEBAYORANBARU", "KEBAYORANLAMA", "MAMPANGPRAPATAN", "PANCORAN", "PASARMINGGU", "PESANGGRAHAN", "SETIABUDI", "TEBET"],
  JAKARTATIMUR: ["CAKUNG", "CIPAYUNG", "CIRACAS", "DURENSAWIT", "JATINEGARA", "KRAMATJATI", "MAKASAR", "MATRAMAN", "PASARREBO", "PULOGADUNG"],
  JAKARTAUTARA: ["CILINCING", "KELAPAGADING", "KOJA", "PADEMANGAN", "PENJARINGAN", "TANJUNGPRIOK"],
  KEPULAUANSERIBU: ["KEPULAUANSERIBUSELATAN", "KEPULAUANSERIBUUTARA"],
};

// Flatten for reverse lookup (district -> city)
const DISTRICT_TO_CITY = {};
Object.entries(CITY_DISTRICTS).forEach(([city, districts]) => {
  districts.forEach((d) => {
    DISTRICT_TO_CITY[d] = city;
  });
});

// ============ DISTRICT ALIAS ============
const DISTRICT_ALIAS_RAW = {
  KELAPAGADINGBARAT: "KELAPAGADING",
  KELAPAGADINGTIMUR: "KELAPAGADING",
  MAMPANG: "MAMPANGPRAPATAN",
  MAMPANGPERAPATAN: "MAMPANGPRAPATAN",
  GROGOL: "GROGOLPETAMBURAN",
  PETAMBURAN: "GROGOLPETAMBURAN",
  GROGOLPERTAMBURAN: "GROGOLPETAMBURAN",
  TANJUNGPRIUK: "TANJUNGPRIOK",
  KEBONJERUKTIMUR: "KEBONJERUK",
  KEBONJERUKUTARA: "KEBONJERUK",
  PALMERIEM: "PALMERAH",
};

const DISTRICT_ALIAS = Object.fromEntries(
  Object.entries(DISTRICT_ALIAS_RAW).map(([k, v]) => [normalizeKey(k), v])
);

const getDistrictKey = (name = "") => {
  const raw = normalizeKey(name);
  return DISTRICT_ALIAS[raw] || raw;
};

// ============ VILLAGE ALIAS ============
const VILLAGE_ALIAS_RAW = {
  HALIMPERDANAKUSUMAH: "HALIMPERDANAKUSUMA",
  PAPANGO: "PAPANGGO",
  PALMERIEM: "PALMERIAM",
  TANJUNGPRIUK: "TANJUNGPRIOK",
  WIJAYAKESUMA: "WIJAYAKUSUMA",
  HARAPANMULYA: "HARAPANMULIA",
  PREPEDAN: "TEGALALUR",
  KAMPUNGTENGAH: "TENGAH",
};

const VILLAGE_ALIAS = Object.fromEntries(
  Object.entries(VILLAGE_ALIAS_RAW).map(([k, v]) => [
    normalizeKey(k),
    normalizeKey(v),
  ])
);

const getVillageKey = (name = "") => {
  const raw = normalizeKey(name);
  return VILLAGE_ALIAS[raw] || raw;
};

// ============ ZOOM THRESHOLDS ============
const ZOOM_KOTA = 11;       // < 11 = show kota
const ZOOM_KECAMATAN = 12;  // 11-11 = show kecamatan, >= 12 = kelurahan

// ============ ZOOM HANDLER ============
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

// ============ MAP CONTROLLER - Auto zoom to selected region ============
function MapController({ geoCity, geoDistrict, geoVillage, selectedCityName, selectedDistrictName }) {
  const map = useMap();

  // Helper to extract Jakarta city key
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
    console.log("🏙️ Looking for city:", selectedCityName, "-> key:", targetKey);

    const cityFeature = geoCity.features?.find((f) => {
      const wadmkk = f.properties?.WADMKK || "";
      const namobj = f.properties?.NAMOBJ || "";
      const featureKey = extractJakartaKey(wadmkk || namobj);
      return featureKey === targetKey;
    });

    if (cityFeature) {
      console.log("✅ Found city feature:", cityFeature.properties);
      const bounds = L.geoJSON(cityFeature).getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [selectedCityName, geoCity, map]);

  // Zoom to selected district
  useEffect(() => {
    if (!selectedDistrictName || !geoDistrict) return;

    const normalizedDistrict = getDistrictKey(selectedDistrictName);
    console.log("🏘️ Looking for district:", selectedDistrictName, "-> normalized:", normalizedDistrict);

    const districtFeature = geoDistrict.features?.find((f) => {
      const name = f.properties?.name || f.properties?.NAMOBJ || "";
      return getDistrictKey(name) === normalizedDistrict;
    });

    if (districtFeature) {
      console.log("✅ Found district feature:", districtFeature.properties);
      const bounds = L.geoJSON(districtFeature).getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [selectedDistrictName, geoDistrict, map]);

  return null;
}

// ============ MAIN COMPONENT ============
export default function KelurahanMap({
  geoCity,       // GeoJSON kota
  geoDistrict,   // GeoJSON kecamatan
  geoVillage,    // GeoJSON kelurahan
  geoSeribu,
  suaraKota,     // Data suara per kota
  suaraKecamatan,// Data suara per kecamatan
  suaraKelurahan,// Data suara per kelurahan
  selectedCityName,     // City to filter districts by (from dropdown)
  selectedDistrictName, // District to filter villages by (from dropdown)
  onRegionClick, // Callback saat wilayah diklik
  onLevelChange, // Callback when zoom level changes
}) {
  const mapRef = useRef();
  const [currentZoom, setCurrentZoom] = useState(10);
  const [prevLevel, setPrevLevel] = useState("kota");

  // Build village-to-district mapping from suaraKelurahan data
  const villageToDistrict = useMemo(() => {
    const mapping = {};
    Object.entries(suaraKelurahan || {}).forEach(([villageName, data]) => {
      if (data && data.district) {
        mapping[getVillageKey(villageName)] = getDistrictKey(data.district);
      }
    });
    return mapping;
  }, [suaraKelurahan]);

  // Determine current level based on zoom
  const currentLevel = useMemo(() => {
    if (currentZoom < ZOOM_KOTA) return "kota";
    if (currentZoom < ZOOM_KECAMATAN) return "kecamatan";
    return "kelurahan";
  }, [currentZoom]);

  // Notify parent when level changes
  useEffect(() => {
    if (currentLevel !== prevLevel) {
      setPrevLevel(currentLevel);
      if (onLevelChange) {
        onLevelChange(currentLevel);
      }
    }
  }, [currentLevel, prevLevel, onLevelChange]);

  // Process votes data for kota
  const kotaVotes = useMemo(() => {
    const out = {};
    Object.entries(suaraKota || {}).forEach(([name, vote]) => {
      out[getCityKey(name)] = vote;
    });
    return out;
  }, [suaraKota]);

  // Process votes data for kecamatan
  const kecamatanVotes = useMemo(() => {
    const out = {};
    Object.entries(suaraKecamatan || {}).forEach(([name, vote]) => {
      out[normalizeKey(name)] = vote;
    });
    return out;
  }, [suaraKecamatan]);

  // Process votes data for kelurahan
  const villageVotes = useMemo(() => {
    const out = {};
    Object.entries(suaraKelurahan || {}).forEach(([name, vote]) => {
      out[getVillageKey(name)] = vote;
    });
    return out;
  }, [suaraKelurahan]);

  useEffect(() => {
    console.log("📍 Current Level:", currentLevel);
    console.log("🏙️ Kota Votes:", Object.keys(kotaVotes).length);
    console.log("🏘️ Kecamatan Votes:", Object.keys(kecamatanVotes).length);
    console.log("🏠 Village Votes:", Object.keys(villageVotes).length);
  }, [currentLevel, kotaVotes, kecamatanVotes, villageVotes]);

  const getWinnerColor = ({ paslon_01 = 0, paslon_02 = 0, paslon_03 = 0 }) => {
    const max = Math.max(paslon_01, paslon_02, paslon_03);
    if (max === paslon_01) return "#FFD100";
    if (max === paslon_02) return "#16a34a";
    return "#C40000";
  };

  // Get name from GeoJSON properties based on level
  const getGeoName = (properties = {}, level) => {
    if (level === "kota") {
      return properties.city || properties.NAMOBJ || properties.WADMKK || properties.NAME || properties.name || "";
    }
    if (level === "kecamatan") {
      return properties.district || properties.name || properties.NAMOBJ || properties.WADMKC || properties.NAME || "";
    }
    // kelurahan
    return (
      properties.village ||
      properties.NAMOBJ ||
      properties.WADMKD ||
      properties.NAME ||
      properties.name ||
      ""
    );
  };

  // Get data based on level
  const getData = (name = "", level) => {
    if (level === "kota") {
      const key = getCityKey(name);
      return kotaVotes[key] || null;
    }
    if (level === "kecamatan") {
      const key = normalizeKey(name);
      return kecamatanVotes[key] || null;
    }
    // kelurahan
    const key = getVillageKey(name);
    return villageVotes[key] || null;
  };

  // Get Current GeoJSON
  const currentGeoJson = useMemo(() => {
    if (currentLevel === "kota") return geoCity;
    if (currentLevel === "kecamatan") return geoDistrict;
    return geoVillage;
  }, [currentLevel, geoCity, geoDistrict, geoVillage]);

  // Check if district belongs to selected city
  const isDistrictInSelectedCity = (districtName) => {
    if (!selectedCityName) return true;
    const canonicalDistrict = getDistrictKey(districtName);
    const cityOfDistrict = DISTRICT_TO_CITY[canonicalDistrict];
    const selectedCityNormalized = getCityKey(selectedCityName);
    return cityOfDistrict === selectedCityNormalized;
  };

  // Check if village belongs to selected district
  const isVillageInSelectedDistrict = (villageName, featureProps = {}) => {
    if (!selectedDistrictName) return true;

    // Try to get district from feature properties first
    const featureDistrict = featureProps.district || featureProps.WADMKC || "";
    if (featureDistrict) {
      return getDistrictKey(featureDistrict) === getDistrictKey(selectedDistrictName);
    }

    // Fallback to mapping
    const villageKey = getVillageKey(villageName);
    const districtOfVillage = villageToDistrict[villageKey];
    return districtOfVillage === getDistrictKey(selectedDistrictName);
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

    // Kecamatan level - filter by city
    if (currentLevel === "kecamatan") {
      if (selectedDistrictName) {
        // If specific district is selected, only show that one
        if (!isSelectedDistrict(name)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.5,
            fillOpacity: 0.5,
          };
        }
      } else if (selectedCityName) {
        // Filter by city
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

    // Kelurahan level - filter by district
    if (currentLevel === "kelurahan") {
      if (selectedDistrictName) {
        if (!isVillageInSelectedDistrict(name, feature.properties)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.3,
            fillOpacity: 0.4,
          };
        }
      } else if (selectedCityName) {
        // When city is selected but not district, show all villages of that city's districts
        const featureDistrict = feature.properties.district || feature.properties.WADMKC || "";
        if (featureDistrict && !isDistrictInSelectedCity(featureDistrict)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.3,
            fillOpacity: 0.4,
          };
        }
      }
    }

    return {
      fillColor: data ? getWinnerColor(data) : "#e5e7eb",
      color: "#ffffff",
      weight: currentLevel === "kota" ? 2 : currentLevel === "kecamatan" ? 1 : 0.5,
      fillOpacity: 0.85,
    };
  };


  const onEachFeature = (feature, layer) => {
    const p = feature.properties;
    const name = getGeoName(p, currentLevel);
    const v = getData(name, currentLevel);

    // Skip tooltip for filtered-out regions
    if (currentLevel === "kecamatan" && selectedCityName && !isDistrictInSelectedCity(name)) {
      return;
    }
    if (currentLevel === "kelurahan" && selectedDistrictName && !isVillageInSelectedDistrict(name, p)) {
      return;
    }

    const levelLabel = currentLevel === "kota" ? "Kota/Kabupaten" :
      currentLevel === "kecamatan" ? "Kecamatan" : "Kelurahan";

    let html = `
    <div style="
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      min-width: 200px;
    ">
      <div style="
        color: #6b7280;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      ">
        ${levelLabel}
      </div>
      <div style="
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 6px;
      ">
        ${name}
      </div>
  `;

    if (v) {
      html += `
      <div style="
        border-top: 1px solid #e5e7eb;
        padding-top: 6px;
        line-height: 1.5;
      ">
        ${[
          ["#FFD100", "Ridwan Kamil – Suswono", v.paslon_01],
          ["#16a34a", "Dharma Pongrekun – Kun Wardana Abyoto", v.paslon_02],
          ["#C40000", "Pramono Anung Wibowo – Rano Karno", v.paslon_03],
        ]
          .map(
            ([color, label, value]) => `
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 6px;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  color: #374151;
                ">
                  <span style="
                    width: 8px;
                    height: 8px;
                    border-radius: 999px;
                    background: ${color};
                    display: inline-block;
                  "></span>
                  <span>${label}</span>
                </div>

                <strong style="
                  color:#111827;
                  min-width: 72px;
                  text-align: right;
                  padding-left: 8px;
                ">
                  ${fmt(value)}
                </strong>
              </div>
            `
          )
          .join("")}
      </div>
    `;
    } else {
      html += `
      <div style="
        margin-top: 6px;
        color: #6b7280;
        font-style: italic;
      ">
        Data tidak tersedia
      </div>
    `;
    }

    html += `</div>`;

    layer.bindTooltip(html, {
      sticky: true,
      direction: "top",
      opacity: 0.95,
    });

    layer.on({
      mouseover: () =>
        layer.setStyle({
          weight: currentLevel === "kota" ? 4 : currentLevel === "kecamatan" ? 2.5 : 1.5,
          fillOpacity: 1,
        }),
      mouseout: () =>
        layer.setStyle({
          weight: currentLevel === "kota" ? 2 : currentLevel === "kecamatan" ? 1 : 0.5,
          fillOpacity: 0.85,
        }),
      click: (e) => {
        // 1. Zoom / FitBounds
        const map = layer._map;
        map.fitBounds(e.target.getBounds());

        // 2. Trigger External Handler
        if (onRegionClick) {
          onRegionClick(name, currentLevel);
        }
      }
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
          geoVillage={geoVillage}
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

      {/* Zoom Level Indicator - Bottom Right */}
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
          {currentLevel === "kota" ? "🏙️ Kota/Kabupaten" :
            currentLevel === "kecamatan" ? "🏘️ Kecamatan" : "🏠 Kelurahan"}
        </div>
        {selectedCityName && (
          <div className="text-blue-600 text-[9px] sm:text-[10px] mt-0.5">
            📍 {selectedCityName}
          </div>
        )}
        {selectedDistrictName && (
          <div className="text-green-600 text-[9px] sm:text-[10px]">
            📍 {selectedDistrictName}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className="
          absolute bottom-3 left-3
          bg-white/60 backdrop-blur-sm
          rounded-lg shadow-md
          px-2 py-1.5
          z-[500]
        "
      >
        <div className="space-y-1 text-[9px] sm:text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FFD100]" />
            <span>Paslon 01 - Ridwan Kamil & Suswono</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#16a34a]" />
            <span>Paslon 02 - Dharma Pongrekun & Kun Wardana Abyoto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#C40000]" />
            <span>Paslon 03 - Pramono Anung & Rano Karno</span>
          </div>
        </div>
      </div>

    </div>
  );
}
