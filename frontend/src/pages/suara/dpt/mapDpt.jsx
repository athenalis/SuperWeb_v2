import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useState, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Icon } from "@iconify/react";

/* =======================
   CONSTANTS
======================= */
const ZOOM_KOTA = 11;
const ZOOM_KECAMATAN = 12;

/* =======================
   UTIL
======================= */
const fmt = (n) => Number(n || 0).toLocaleString("id-ID");

const normalizeKey = (str = "") =>
  str
    .toString()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

    
    const normalizeCityDisplay = (name = "") => {
      const key = normalizeKey(name);
      return CITY_DISPLAY_MAP[key] || name;
    };
    
/* =======================
   CITY ALIAS
======================= */
const CITY_ALIAS_RAW = {
  KOTAADMJAKARTABARAT: "JAKARTABARAT",
  KOTAADMJAKARTAPUSAT: "JAKARTAPUSAT",
  KOTAADMJAKARTASELATAN: "JAKARTASELATAN",
  KOTAADMJAKARTATIMUR: "JAKARTATIMUR",
  KOTAADMJAKARTAUTARA: "JAKARTAUTARA",
  ADMJAKARTABARAT: "JAKARTABARAT",
  ADMJAKARTAPUSAT: "JAKARTAPUSAT",
  ADMJAKARTASELATAN: "JAKARTASELATAN",
  ADMJAKARTATIMUR: "JAKARTATIMUR",
  ADMJAKARTAUTARA: "JAKARTAUTARA",
  KABADMKEPSERIBU: "KEPULAUANSERIBU",
  KABUPATENADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  ADMKEPSERIBU: "KEPULAUANSERIBU",
  KEPULAUANSERIBU: "KEPULAUANSERIBU",
  KABADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  ADMKEPULAUANSERIBU: "KEPULAUANSERIBU",
  KEPSERIBU: "KEPULAUANSERIBU",
};

const CITY_ALIAS = Object.fromEntries(
  Object.entries(CITY_ALIAS_RAW).map(([k, v]) => [normalizeKey(k), normalizeKey(v)])
);

const getCityKey = (name = "") => {
  const raw = normalizeKey(name);
  return CITY_ALIAS[raw] || raw;
};

/* =======================
   CITY TO DISTRICT MAPPING
======================= */
const CITY_DISTRICTS = {
  JAKARTABARAT: ["CENGKARENG", "GROGOLPETAMBURAN", "TAMANSARI", "TAMBORA", "KEBONJERUK", "KALIDERES", "PALMERAH", "KEMBANGAN"],
  JAKARTAPUSAT: ["CEMPAKAPUTIH", "GAMBIR", "JOHARBARU", "KEMAYORAN", "MENTENG", "SAWAHBESAR", "SENEN", "TANAHABANG"],
  JAKARTASELATAN: ["CILANDAK", "JAGAKARSA", "KEBAYORANBARU", "KEBAYORANLAMA", "MAMPANGPRAPATAN", "PANCORAN", "PASARMINGGU", "PESANGGRAHAN", "SETIABUDI", "TEBET"],
  JAKARTATIMUR: ["CAKUNG", "CIPAYUNG", "CIRACAS", "DURENSAWIT", "JATINEGARA", "KRAMATJATI", "MAKASAR", "MATRAMAN", "PASARREBO", "PULOGADUNG"],
  JAKARTAUTARA: ["CILINCING", "KELAPAGADING", "KOJA", "PADEMANGAN", "PENJARINGAN", "TANJUNGPRIOK"],
  KEPULAUANSERIBU: ["KEPULAUANSERIBUSELATAN", "KEPULAUANSERIBUUTARA"],
};

const DISTRICT_TO_CITY = {};
Object.entries(CITY_DISTRICTS).forEach(([city, districts]) => {
  districts.forEach((d) => {
    DISTRICT_TO_CITY[d] = city;
  });
});

/* =======================
   DISTRICT ALIAS
======================= */
const DISTRICT_ALIAS_RAW = {
  KELAPAGADINGBARAT: "KELAPAGADING",
  KELAPAGADINGTIMUR: "KELAPAGADING",
  MAMPANG: "MAMPANGPRAPATAN",
  MAMPANGPERAPATAN: "MAMPANGPRAPATAN",
  GROGOLPETAMBURAN: "GROGOLPERTAMBURAN",
  GROGOL: "GROGOLPERTAMBURAN",
  PETAMBURAN: "GROGOLPERTAMBURAN",
  GROGOLPERTAMBURAN: "GROGOLPERTAMBURAN",
  TANJUNGPRIUK: "TANJUNGPRIOK",
  KEPULAUANSERIBUSELATAN: "KEPULAUANSERIBUSELATAN.",
};

const DISTRICT_ALIAS = Object.fromEntries(
  Object.entries(DISTRICT_ALIAS_RAW).map(([k, v]) => [normalizeKey(k), v])
);

const getDistrictKey = (name = "") => {
  const raw = normalizeKey(name);
  return DISTRICT_ALIAS[raw] || raw;
};

/* =======================
   VILLAGE ALIAS
======================= */
const VILLAGE_ALIAS_RAW = {
  PAPANGO: "PAPANGGO",
  WIJAYAKESUMA: "WIJAYAKUSUMA",
  HARAPANMULYA: "HARAPANMULIA",
  PALMERIEM: "PALMERAH",
  HALIMPERDANAKUSUMAH: "HALIMPERDANAKUSUMA",
  KAMPUNGTENGAH: "TENGAH",
  PREPEDAN: "TEGALALUR",
  TANJUNGPRIUK: "TANJUNGPRIOK",
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

const getPriorityTextColor = (hexColor = "#ffffff") => {
  const color = hexColor.toLowerCase();

  if (color === "#acacac" || color === "#acacacff") {
    return "#ffffff";
  }

  if (color === "#ffffb2") {
    return "#5c3a00";
  }

  if (color === "#fecc5c") {
    return "#5c3a00";
  }

  if (color === "#fd8d3c") {
    return "#ffffff";
  }

  return "#ffffff";
};


/* =======================
   ZOOM HANDLER
======================= */
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

/* =======================
   MAP CONTROLLER - Auto zoom to selected region
======================= */
function MapController({ geoCity, geoDistrict, selectedCityName, selectedDistrictName }) {
  const map = useMap();

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

    const cityFeature = geoCity.features?.find((f) => {
      const wadmkk = f.properties?.WADMKK || "";
      const namobj = f.properties?.NAMOBJ || "";
      const featureKey = extractJakartaKey(wadmkk || namobj);
      return featureKey === targetKey;
    });

    if (cityFeature) {
      const bounds = L.geoJSON(cityFeature).getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [selectedCityName, geoCity, map]);

  // Zoom to selected district
  useEffect(() => {
    if (!selectedDistrictName || !geoDistrict) return;

    const normalizedDistrict = getDistrictKey(selectedDistrictName);

    const districtFeature = geoDistrict.features?.find((f) => {
      const name = f.properties?.name || f.properties?.NAMOBJ || "";
      return getDistrictKey(name) === normalizedDistrict;
    });

    if (districtFeature) {
      const bounds = L.geoJSON(districtFeature).getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [selectedDistrictName, geoDistrict, map]);

  return null;
}

/* =======================
   MAIN MAP COMPONENT
======================= */
export default function MapDpt({
  geoCity,
  geoDistrict,
  geoVillage,
  geoSeribu,
  dptKota,
  dptKecamatan,
  dptKelurahan,
  legend,
  selectedCityName,
  selectedDistrictName,
  onRegionClick,
  onLevelChange,
}) {
  const getCityDataKey = (name = "") => {
    const raw = normalizeKey(name);
  
    if (dptKota && dptKota[raw]) return raw;
  
    const logicKey = CITY_ALIAS[raw];
    if (logicKey && dptKota && dptKota[logicKey]) return logicKey;

    if (raw.includes("SERIBU")) {
      if (dptKota["KEPULAUANSERIBU"]) return "KEPULAUANSERIBU";
      if (dptKota["KABADMKEPSERIBU"]) return "KABADMKEPSERIBU";
    }
  
    return raw;
  };
  
  const mapRef = useRef();
  const [currentZoom, setCurrentZoom] = useState(10);
  const [prevLevel, setPrevLevel] = useState("kota");

  // Determine Level
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

  // Get GeoName
  const getGeoName = (properties = {}, level) => {
    if (level === "kota") {
      return properties.city || properties.NAMOBJ || properties.WADMKK || properties.NAME || properties.name || "";
    }
    if (level === "kecamatan") {
      return properties.district || properties.name || properties.NAMOBJ || properties.WADMKC || properties.NAME || "";
    }
    return (
      properties.village ||
      properties.NAMOBJ ||
      properties.WADMKD ||
      properties.NAME ||
      properties.name ||
      ""
    );
  };

  const getData = (name = "", level) => {
    if (!name) return null;
  
    if (level === "kota") {
      const key = getCityDataKey(name);
      return dptKota[key];
    }
  
    if (level === "kecamatan") {
      const key = getDistrictKey(name);
      return dptKecamatan[key];
    }
  
    // 🔥 KELURAHAN
    const key = getVillageKey(name);
    return dptKelurahan[key];
  };
  

  // Current GeoJSON
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
        if (!isSelectedDistrict(name)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.5,
            fillOpacity: 0.5,
          };
        }
      } else if (selectedCityName) {
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
        const featureDistrict = feature.properties.district || feature.properties.WADMKC || "";
        if (featureDistrict && getDistrictKey(featureDistrict) !== getDistrictKey(selectedDistrictName)) {
          return {
            fillColor: "#f3f4f6",
            color: "#d1d5db",
            weight: 0.3,
            fillOpacity: 0.4,
          };
        }
      } else if (selectedCityName) {
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
      fillColor: data?.color || "#e5e7eb",
      color: "#ffffff",
      weight: currentLevel === "kota" ? 2 : currentLevel === "kecamatan" ? 1 : 0.5,
      fillOpacity: 0.85,
    };
  };

  // Tooltip
  const onEachFeature = (feature, layer) => {
    const name = getGeoName(feature.properties, currentLevel);
    const data = getData(name, currentLevel);

    // Skip tooltip for filtered-out regions
    if (currentLevel === "kecamatan" && selectedCityName && !isDistrictInSelectedCity(name)) {
      return;
    }

    const levelLabel =
      currentLevel === "kota"
        ? "Kota/Kabupaten"
        : currentLevel === "kecamatan"
          ? "Kecamatan"
          : "Kelurahan";

    let html = `
      <div style="font-family:system-ui;font-size:12px;min-width:180px">
        <div style="color:#6b7280;font-size:10px;text-transform:uppercase;margin-bottom:2px">
          ${levelLabel}
        </div>
        <div style="font-weight:600;font-size:13px;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px">
          ${name}
        </div>
    `;

    if (data) {
      html += `
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
          <span>Total DPT</span>
          <b>${fmt(data.total_dpt)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
          <span>Kepadatan</span>
          <span>${fmt(data.density)} /km²</span>
         </div>
        <div style="margin-top:6px">
          <span
            style="
              display:inline-block;
              padding:2px 8px;
              border-radius:999px;
              background:${data.color};
              color:${getPriorityTextColor(data.color)};
              font-size:10px;
              font-weight:600;
              line-height:1.4;
              white-space:nowrap;
            "
          >
            ${data.priority || ""}
          </span>
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
          weight: currentLevel === "kota" ? 4 : currentLevel === "kecamatan" ? 2.5 : 1.5,
          fillOpacity: 1,
        }),
      mouseout: () =>
        layer.setStyle({
          weight: currentLevel === "kota" ? 2 : currentLevel === "kecamatan" ? 1 : 0.5,
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

  // Find Kepulauan Seribu Data for Table Inset
  const kepSeribuData = useMemo(() => {
    if (dptKota && dptKota["ADMKEPULAUANSERIBU"]) return dptKota["ADMKEPULAUANSERIBU"];
    if (dptKota && dptKota["KEPULAUANSERIBU"]) return dptKota["KEPULAUANSERIBU"];
    return null;
  }, [dptKota]);


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
        <div className="font-semibold text-slate-800 flex items-center gap-1">
          {currentLevel === "kota" && (
            <>
              <Icon icon="mdi:city" className="w-4 h-4" />
              <span>Kota/Kabupaten</span>
            </>
          )}
          {currentLevel === "kecamatan" && (
            <>
              <Icon icon="mdi:home-city" className="w-4 h-4" />
              <span>Kecamatan</span>
            </>
          )}
          {currentLevel === "kelurahan" && (
            <>
              <Icon icon="mdi:home-group" className="w-4 h-4" />
              <span>Kelurahan</span>
            </>
          )}
        </div>
        {selectedCityName && (
          <div className="text-blue-600 text-[9px] sm:text-[10px] mt-0.5 flex items-center gap-1">
            <Icon icon="mdi:map-marker" className="w-3 h-3" />
            <span>{selectedCityName}</span>
          </div>
        )}
        {selectedDistrictName && (
          <div className="text-green-600 text-[9px] sm:text-[10px] flex items-center gap-1">
            <Icon icon="mdi:map-marker" className="w-3 h-3" />
            <span>{selectedDistrictName}</span>
          </div>
        )}
      </div>

      {/* Legend - Bottom Left */}
      {legend && legend.length > 0 && (
        <div
          className="
            absolute bottom-3 left-3
            bg-white/60 backdrop-blur-sm
            rounded-lg shadow-md
            px-2 py-1.5
            z-[500]
          "
        >
          <div className="text-[10px] font-semibold text-slate-700 mb-1">Daerah Prioritas DPT</div>
          <div className="text-[8px] text-slate-500 mb-2">Berdasarkan kepadatan DPT/km²</div>
          <div className="space-y-0.5 text-[9px] sm:text-[10px]">
            {legend.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
